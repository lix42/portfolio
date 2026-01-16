import { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_MS } from "@portfolio/shared";

import { STEP_HANDLERS, STEP_NEXT } from "./steps";
import type {
  DocumentState,
  ProcessingError,
  ProcessingStatus,
  StepContext,
} from "./types";
import { convertStateToStatus } from "./utils";
import {
  createChunkStorage,
  createInitialDocumentState,
  getDocumentState,
  saveDocumentState,
} from "./utils/storage";

/**
 * DocumentProcessor Durable Object
 *
 * Orchestrator for document processing pipeline:
 * 1. Download from R2 and chunk
 * 2. Generate embeddings (batched)
 * 3. Generate tags (batched)
 * 4. Store to D1 and Vectorize
 *
 * Design principles:
 * - Minimal orchestrator - domain logic extracted to pure functions
 * - Each step is idempotent and resumable
 * - State is persisted after each step via context.next()
 * - Batched processing to stay within Worker limits
 * - Two-phase commit: Vectorize first (idempotent), then D1
 */
export class DocumentProcessor implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * HTTP handler for Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (!this.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      // Route handlers
      if (path === "/process" && request.method === "POST") {
        const { r2Key } = (await request.json()) as { r2Key: string };
        await this.startProcessing(r2Key);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path === "/status" && request.method === "GET") {
        const status = await this.getStatus();
        return new Response(JSON.stringify(status), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path === "/resume" && request.method === "POST") {
        await this.resumeProcessing();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path === "/reprocess" && request.method === "POST") {
        const { r2Key } = (await request.json()) as { r2Key: string };
        await this.reprocessDocument(r2Key);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path === "/delete" && request.method === "DELETE") {
        await this.deleteState();
        return new Response(JSON.stringify({ ok: true, deleted: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("Durable Object error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  /**
   * Start processing a new document
   */
  private async startProcessing(r2Key: string): Promise<void> {
    if (!r2Key) {
      throw new Error("r2Key required");
    }

    // Check if already processing
    const existing = await getDocumentState(this.state.storage);
    if (
      existing &&
      (existing.status === "processing" || existing.status === "completed")
    ) {
      console.log(
        `Document ${r2Key} already ${existing.status}, skipping restart`,
      );
      return;
    }

    // Initialize document state (chunks stored separately)
    const initialState = createInitialDocumentState(r2Key);
    await saveDocumentState(this.state.storage, initialState);

    // Start processing via orchestrator
    await this.resumeProcessing();
  }

  /**
   * Resume processing from current state
   * Can be called after interruption or error
   */
  private async resumeProcessing(): Promise<void> {
    await this.executeCurrentStep();
  }

  /**
   * Reprocess an existing document
   * Cleans up existing data and starts fresh processing
   */
  private async reprocessDocument(r2Key: string): Promise<void> {
    if (!r2Key) {
      throw new Error("r2Key required");
    }

    // Get existing state
    const existing = await getDocumentState(this.state.storage);

    // Block if currently processing
    if (existing?.status === "processing") {
      throw new Error(
        "Document is currently being processed. Cannot reprocess until current processing completes.",
      );
    }

    // Cleanup existing data from D1 if document was previously stored
    if (existing?.documentId) {
      console.log(
        `[${r2Key}] Cleaning up existing document (ID: ${existing.documentId}) before reprocessing`,
      );

      try {
        // Delete from D1 (cascades to chunks via foreign key constraint)
        const result = await this.env.DB.prepare(
          "DELETE FROM documents WHERE id = ?",
        )
          .bind(existing.documentId)
          .run();

        console.log(
          `[${r2Key}] Deleted ${result.meta.changes} document record(s) from D1`,
        );
      } catch (error) {
        console.error(`[${r2Key}] Failed to cleanup D1 records:`, error);
        throw new Error(
          `Failed to cleanup existing data: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Clear all existing state (document + chunks)
    await this.state.storage.deleteAll();

    // Reset to fresh initial state
    const initialState = createInitialDocumentState(r2Key);
    await saveDocumentState(this.state.storage, initialState);

    console.log(`[${r2Key}] Starting reprocessing from scratch`);

    // Start processing
    await this.resumeProcessing();
  }

  /**
   * Generic orchestrator that executes steps based on current state
   * Core of the step-based architecture
   */
  private async executeCurrentStep(): Promise<void> {
    const documentState = await getDocumentState(this.state.storage);
    if (!documentState) {
      throw new Error("No processing state found");
    }

    // Look up step handler
    const handler = STEP_HANDLERS.get(documentState.currentStep);
    if (!handler) {
      throw new Error(`Unknown step: ${documentState.currentStep}`);
    }

    // Prepare context
    const context = this.createStepContext(documentState);

    try {
      // Execute step
      await handler(context);
    } catch (error) {
      await this.handleError(documentState, error);
    }
  }

  /**
   * Create context object for step execution
   * Provides all resources and control flow to steps
   */
  private createStepContext(state: DocumentState): StepContext {
    return {
      state,

      // Chunk storage operations (separate keys per chunk)
      chunks: createChunkStorage(this.state.storage),

      env: {
        DOCUMENTS_BUCKET: this.env.DOCUMENTS_BUCKET,
        DB: this.env.DB,
        VECTORIZE: this.env.VECTORIZE,
        OPENAI_API_KEY: this.env.OPENAI_API_KEY,
      },

      next: async (options?: { continueCurrentStep?: boolean }) => {
        if (!options?.continueCurrentStep) {
          // Auto-advance to next step based on registry
          const nextStep = STEP_NEXT.get(state.currentStep);
          if (!nextStep) {
            throw new Error(`No next step defined for: ${state.currentStep}`);
          }

          state.currentStep = nextStep;

          // Mark as completed when reaching terminal state
          if (nextStep === "complete" && state.status !== "completed") {
            state.status = "completed";
            state.completedAt = new Date().toISOString();
            console.log(
              `[${state.r2Key}] Processing complete! Document ID: ${state.documentId}`,
            );
          }
        }
        // If continueCurrentStep is true, keep currentStep unchanged (for batching)

        // Save document state only (chunks saved separately by steps)
        await saveDocumentState(this.state.storage, state);

        // Continue execution
        await this.executeCurrentStep();
      },

      fail: async (error: unknown) => {
        await this.handleError(state, error);
      },
    };
  }

  /**
   * Get current processing status
   */
  private async getStatus(): Promise<ProcessingStatus> {
    const documentState = await getDocumentState(this.state.storage);
    return convertStateToStatus(documentState);
  }

  /**
   * Delete all state from this Durable Object
   */
  private async deleteState(): Promise<void> {
    await this.state.storage.deleteAll();
  }

  /**
   * Handle error with retry logic
   */
  private async handleError(
    documentState: DocumentState,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable = this.isRetryableError(error);

    const processingError: ProcessingError = {
      step: documentState.currentStep,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      retryable: isRetryable,
    };

    documentState.errors.push(processingError);

    // Retry logic
    if (isRetryable && documentState.retryCount < MAX_RETRY_ATTEMPTS) {
      documentState.retryCount++;
      const backoffMs = RETRY_BACKOFF_MS * 2 ** documentState.retryCount;

      console.log(
        `[${documentState.r2Key}] Retrying after ${backoffMs}ms (attempt ${documentState.retryCount}/${MAX_RETRY_ATTEMPTS})`,
      );

      await saveDocumentState(this.state.storage, documentState);

      // Schedule retry using alarm
      await this.state.storage.setAlarm(Date.now() + backoffMs);
    } else {
      // Mark as failed
      documentState.status = "failed";
      documentState.failedAt = new Date().toISOString();
      await saveDocumentState(this.state.storage, documentState);

      console.error(
        `[${documentState.r2Key}] Processing failed permanently:`,
        errorMessage,
      );
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors, rate limits, temporary failures
      const retryableMessages = [
        "rate limit",
        "timeout",
        "network",
        "temporary",
        "service unavailable",
        "503",
        "429",
      ];
      return retryableMessages.some((msg) =>
        error.message.toLowerCase().includes(msg),
      );
    }
    return false;
  }

  /**
   * Handle alarm for retry
   */
  async alarm(): Promise<void> {
    console.log("Alarm triggered, resuming processing");
    await this.resumeProcessing();
  }
}
