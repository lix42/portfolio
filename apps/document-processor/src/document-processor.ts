import { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_MS } from '@portfolio/shared';

import { STEP_HANDLERS, STEP_NEXT } from './steps';
import type {
  ProcessingError,
  ProcessingState,
  ProcessingStatus,
  StepContext,
} from './types';
import { convertStateToStatus } from './utils';

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
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Route handlers
      if (path === '/process' && request.method === 'POST') {
        const { r2Key } = (await request.json()) as { r2Key: string };
        await this.startProcessing(r2Key);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/status' && request.method === 'GET') {
        const status = await this.getStatus();
        return new Response(JSON.stringify(status), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/resume' && request.method === 'POST') {
        await this.resumeProcessing();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Durable Object error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Start processing a new document
   */
  private async startProcessing(r2Key: string): Promise<void> {
    if (!r2Key) {
      throw new Error('r2Key required');
    }

    // Check if already processing
    const existing = await this.state.storage.get<ProcessingState>('state');
    if (
      existing &&
      (existing.status === 'processing' || existing.status === 'completed')
    ) {
      console.log(
        `Document ${r2Key} already ${existing.status}, skipping restart`
      );
      return;
    }

    // Initialize state
    const initialState: ProcessingState = {
      status: 'processing',
      r2Key,
      startedAt: new Date().toISOString(),
      currentStep: 'download',
      chunks: [],
      totalChunks: 0,
      processedChunks: 0,
      embeddingBatchIndex: 0,
      tagsBatchIndex: 0,
      errors: [],
      retryCount: 0,
    };

    await this.state.storage.put('state', initialState);

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
   * Generic orchestrator that executes steps based on current state
   * Core of the step-based architecture
   */
  private async executeCurrentStep(): Promise<void> {
    const processingState =
      await this.state.storage.get<ProcessingState>('state');
    if (!processingState) {
      throw new Error('No processing state found');
    }

    // Look up step handler
    const handler = STEP_HANDLERS.get(processingState.currentStep);
    if (!handler) {
      throw new Error(`Unknown step: ${processingState.currentStep}`);
    }

    // Prepare context
    const context = this.createStepContext(processingState);

    try {
      // Execute step
      await handler(context);
    } catch (error) {
      await this.handleError(processingState, error);
    }
  }

  /**
   * Create context object for step execution
   * Provides all resources and control flow to steps
   */
  private createStepContext(state: ProcessingState): StepContext {
    return {
      state,

      storage: {
        get: <T>(key: string) => this.state.storage.get<T>(key),
        put: (key: string, value: unknown) =>
          this.state.storage.put(key, value),
        setAlarm: (scheduledTime: number) =>
          this.state.storage.setAlarm(scheduledTime),
      },

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
          if (nextStep === 'complete' && state.status !== 'completed') {
            state.status = 'completed';
            state.completedAt = new Date().toISOString();
            console.log(
              `[${state.r2Key}] Processing complete! Document ID: ${state.documentId}`
            );
          }
        }
        // If continueCurrentStep is true, keep currentStep unchanged (for batching)

        // Save state
        await this.state.storage.put('state', state);

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
    const processingState =
      await this.state.storage.get<ProcessingState>('state');
    return convertStateToStatus(processingState);
  }

  /**
   * Handle error with retry logic
   */
  private async handleError(
    processingState: ProcessingState,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryable = this.isRetryableError(error);

    const processingError: ProcessingError = {
      step: processingState.currentStep,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      retryable: isRetryable,
    };

    processingState.errors.push(processingError);

    // Retry logic
    if (isRetryable && processingState.retryCount < MAX_RETRY_ATTEMPTS) {
      processingState.retryCount++;
      const backoffMs =
        RETRY_BACKOFF_MS * Math.pow(2, processingState.retryCount);

      console.log(
        `[${processingState.r2Key}] Retrying after ${backoffMs}ms (attempt ${processingState.retryCount}/${MAX_RETRY_ATTEMPTS})`
      );

      await this.state.storage.put('state', processingState);

      // Schedule retry using alarm
      await this.state.storage.setAlarm(Date.now() + backoffMs);
    } else {
      // Mark as failed
      processingState.status = 'failed';
      processingState.failedAt = new Date().toISOString();
      await this.state.storage.put('state', processingState);

      console.error(
        `[${processingState.r2Key}] Processing failed permanently:`,
        errorMessage
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
        'rate limit',
        'timeout',
        'network',
        'temporary',
        'service unavailable',
        '503',
        '429',
      ];
      return retryableMessages.some((msg) =>
        error.message.toLowerCase().includes(msg)
      );
    }
    return false;
  }

  /**
   * Handle alarm for retry
   */
  async alarm(): Promise<void> {
    console.log('Alarm triggered, resuming processing');
    await this.resumeProcessing();
  }
}
