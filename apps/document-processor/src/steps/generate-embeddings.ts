import {
  EMBEDDING_BATCH_SIZE,
  generateEmbeddingsBatch,
} from "@portfolio/shared";

import type { StepContext } from "../types";
import { syncProcessedChunks } from "../utils";

/**
 * Step 2: Generate embeddings in batches
 * Uses self-continuation pattern: processes one batch, then calls next() to continue
 * Each chunk is saved separately to avoid 128KB limit
 */
export async function stepGenerateEmbeddingsBatch(
  context: StepContext,
): Promise<void> {
  console.log(`[${context.state.r2Key}] Step 2: Generate embeddings batch`);

  // Get chunks that need embeddings (from separate storage keys)
  const pendingChunks = await context.chunks.getChunksByStatus("pending");

  if (pendingChunks.length === 0) {
    // All embeddings done, advance to next step in pipeline
    await syncProcessedChunks(context);
    await context.next();
    return;
  }

  // Process batch
  const batch = pendingChunks.slice(0, EMBEDDING_BATCH_SIZE);
  const texts = batch.map((c) => c.text);

  const embeddings = await generateEmbeddingsBatch(texts, {
    apiKey: context.env.OPENAI_API_KEY,
  });

  if (embeddings.length === 0) {
    throw new Error("No embeddings returned from OpenAI");
  }

  // Update chunks with embeddings and save each separately
  const updatedChunks = batch.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx] ?? null,
    status: "embedding_done" as const,
  }));

  // Save updated chunks (each to its own key)
  await context.chunks.saveChunks(updatedChunks);

  await syncProcessedChunks(context);

  // Re-execute current step for next batch (save state but don't advance)
  await context.next({ continueCurrentStep: true });
}
