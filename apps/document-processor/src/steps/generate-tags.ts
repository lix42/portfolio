import { generateTagsBatch, TAG_BATCH_SIZE } from '@portfolio/shared';

import type { StepContext } from '../types';
import { syncProcessedChunks } from '../utils';

/**
 * Step 3: Generate tags in batches
 * Uses self-continuation pattern: processes one batch, then calls next() to continue
 * Each chunk is saved separately to avoid 128KB limit
 */
export async function stepGenerateTagsBatch(
  context: StepContext
): Promise<void> {
  console.log(`[${context.state.r2Key}] Step 3: Generate tags batch`);

  // Get chunks that need tags (have embeddings but no tags)
  const pendingChunks =
    await context.chunks.getChunksByStatus('embedding_done');

  if (pendingChunks.length === 0) {
    // All tags done, advance to next step in pipeline
    await syncProcessedChunks(context);
    await context.next();
    return;
  }

  // Process batch
  const batch = pendingChunks.slice(0, TAG_BATCH_SIZE);
  const texts = batch.map((c) => c.text);

  const tagsBatch = await generateTagsBatch(texts, {
    apiKey: context.env.OPENAI_API_KEY,
  });

  // Update chunks with tags and save each separately
  const updatedChunks = batch.map((chunk, idx) => ({
    ...chunk,
    tags: tagsBatch[idx] ?? [],
    status: 'tags_done' as const,
  }));

  // Save updated chunks (each to its own key)
  await context.chunks.saveChunks(updatedChunks);

  await syncProcessedChunks(context);

  // Re-execute current step for next batch (save state but don't advance)
  await context.next({ continueCurrentStep: true });
}
