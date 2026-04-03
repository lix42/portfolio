import type { ProcessingStatus, ReconciliationResult } from "./types";

const BATCH_SIZE = 100;
const STUCK_THRESHOLD_HOURS = 24;

/**
 * Reconcile R2 documents with D1 database
 *
 * Discovers documents in R2 that:
 * 1. Are not yet in D1 (missed events)
 * 2. Have failed processing
 * 3. Are stuck in processing state (> 24 hours)
 */
export async function reconcileR2Documents(
  env: Env,
): Promise<ReconciliationResult> {
  const startTime = Date.now();
  console.log("Starting R2 reconciliation");

  const result: ReconciliationResult = {
    checked: 0,
    queued: 0,
    retried: 0,
    skipped: 0,
    errors: 0,
  };

  let cursor: string | undefined;
  let batchNumber = 0;

  do {
    batchNumber++;
    const listOptions: R2ListOptions = {
      limit: BATCH_SIZE,
      include: ["customMetadata"],
    };
    if (cursor) {
      listOptions.cursor = cursor;
    }

    const listed = await env.DOCUMENTS_BUCKET.list(listOptions);
    const mdFiles = listed.objects.filter((o) => o.key.endsWith(".md"));
    console.log(
      `Batch ${batchNumber}: ${listed.objects.length} objects, ${mdFiles.length} markdown files`,
    );

    for (const object of mdFiles) {
      await processDocument(env, object.key, result);
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const durationMs = Date.now() - startTime;
  console.log(
    `Reconciliation complete in ${durationMs}ms: checked=${result.checked}, queued=${result.queued}, retried=${result.retried}, skipped=${result.skipped}, errors=${result.errors}`,
  );

  return result;
}

/**
 * Process a single document and update the result counters
 */
async function processDocument(
  env: Env,
  r2Key: string,
  result: ReconciliationResult,
): Promise<void> {
  result.checked++;

  try {
    const action = await determineAction(env, r2Key);

    switch (action) {
      case "queue":
        await triggerProcessing(env, r2Key);
        result.queued++;
        console.log(`[${r2Key}] Queued for processing`);
        break;

      case "retry":
        await resumeProcessing(env, r2Key);
        result.retried++;
        console.log(`[${r2Key}] Retried stuck document`);
        break;

      case "skip":
        result.skipped++;
        break;
    }
  } catch (error) {
    result.errors++;
    console.error(`[${r2Key}] Error during reconciliation:`, error);
  }
}

type ReconcileAction = "queue" | "retry" | "skip";

/**
 * Determine what action to take for a document
 */
async function determineAction(
  env: Env,
  r2Key: string,
): Promise<ReconcileAction> {
  // Check if document exists in D1
  const existing = await env.DB.prepare(
    "SELECT id FROM documents WHERE r2_key = ?",
  )
    .bind(r2Key)
    .first<{ id: number }>();

  if (existing) {
    return "skip";
  }

  // Check Durable Object status
  const status = await getProcessingStatus(env, r2Key);

  switch (status.status) {
    case "not_started":
      console.log(`[${r2Key}] Not started, will queue for processing`);
      return "queue";

    case "failed":
      console.log(
        `[${r2Key}] Previously failed at step "${status.currentStep}", will re-queue`,
      );
      return "queue";

    case "processing":
      if (isStuck(status)) {
        console.warn(
          `[${r2Key}] Stuck in "${status.currentStep}" since ${status.timing.startedAt}, will retry`,
        );
        return "retry";
      }
      return "skip";

    case "completed":
      // Completed in DO but not in D1 — data may have been lost
      console.warn(
        `[${r2Key}] Completed in DO (documentId=${status.documentId}) but missing from D1, will re-queue`,
      );
      return "queue";

    default:
      console.warn(`[${r2Key}] Unknown status "${status.status}", skipping`);
      return "skip";
  }
}

/**
 * Get processing status from Durable Object
 */
async function getProcessingStatus(
  env: Env,
  r2Key: string,
): Promise<ProcessingStatus> {
  const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
  const stub = env.DOCUMENT_PROCESSOR.get(id);

  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/status", {
    method: "GET",
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `[${r2Key}] Failed to get processing status: ${response.status} ${body}`,
    );
    throw new Error(
      `Failed to get status for ${r2Key}: ${response.status} ${body}`,
    );
  }

  return response.json();
}

/**
 * Trigger processing for a document via Durable Object
 */
async function triggerProcessing(env: Env, r2Key: string): Promise<void> {
  const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
  const stub = env.DOCUMENT_PROCESSOR.get(id);

  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ r2Key }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[${r2Key}] Failed to trigger processing: ${error}`);
    throw new Error(`Failed to trigger processing for ${r2Key}: ${error}`);
  }
}

/**
 * Resume a stuck document via Durable Object
 */
async function resumeProcessing(env: Env, r2Key: string): Promise<void> {
  const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
  const stub = env.DOCUMENT_PROCESSOR.get(id);

  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/resume", {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[${r2Key}] Failed to resume processing: ${error}`);
    throw new Error(`Failed to resume processing for ${r2Key}: ${error}`);
  }
}

/**
 * Check if a processing job is stuck (> 24 hours)
 */
function isStuck(status: ProcessingStatus): boolean {
  if (status.status !== "processing" || !status.timing.startedAt) {
    return false;
  }

  const startedAt = new Date(status.timing.startedAt);
  const hoursElapsed = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);

  return hoursElapsed > STUCK_THRESHOLD_HOURS;
}
