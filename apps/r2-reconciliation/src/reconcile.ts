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
  const result: ReconciliationResult = {
    checked: 0,
    queued: 0,
    retried: 0,
    skipped: 0,
  };

  let cursor: string | undefined;

  do {
    const listOptions: R2ListOptions = {
      limit: BATCH_SIZE,
      include: ["customMetadata"],
    };
    if (cursor) {
      listOptions.cursor = cursor;
    }

    const listed = await env.DOCUMENTS_BUCKET.list(listOptions);

    for (const object of listed.objects) {
      if (object.key.endsWith(".md")) {
        await processDocument(env, object.key, result);
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  console.log(
    `Reconciliation complete: checked=${result.checked}, queued=${result.queued}, retried=${result.retried}, skipped=${result.skipped}`,
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
        console.log(`Queued for processing: ${r2Key}`);
        break;

      case "retry":
        await resumeProcessing(env, r2Key);
        result.retried++;
        console.log(`Retried stuck document: ${r2Key}`);
        break;

      case "skip":
        result.skipped++;
        break;
    }
  } catch (error) {
    console.error(`Error processing ${r2Key}:`, error);
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
    // Document already processed
    return "skip";
  }

  // Check Durable Object status
  const status = await getProcessingStatus(env, r2Key);

  switch (status.status) {
    case "not_started":
    case "failed":
      return "queue";

    case "processing":
      // Check if stuck (> 24 hours)
      if (isStuck(status)) {
        return "retry";
      }
      return "skip";

    case "completed":
      // Completed but not in D1 - unusual state, queue for reprocessing
      return "queue";

    default:
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
    throw new Error(`Failed to get status for ${r2Key}: ${response.status}`);
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
