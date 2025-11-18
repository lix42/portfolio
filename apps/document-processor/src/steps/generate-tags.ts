import { generateTagsBatch, TAG_BATCH_SIZE } from '@portfolio/shared';

import type { StepContext } from '../types';

/**
 * Step 3: Generate tags in batches
 * Uses self-continuation pattern: processes one batch, then calls next() to continue
 */
export async function stepGenerateTagsBatch(
  context: StepContext
): Promise<void> {
  console.log(
    `[${context.state.r2Key}] Step 3: Generate tags batch ${context.state.tagsBatchIndex}`
  );

  // Get chunks that need tags
  const pendingChunks = context.state.chunks.filter((c) => c.tags === null);

  if (pendingChunks.length === 0) {
    // All tags done, advance to next step in pipeline
    await context.next();
    return;
  }

  // Process batch
  const batch = pendingChunks.slice(0, TAG_BATCH_SIZE);
  const texts = batch.map((c) => c.text);

  const tagsBatch = await generateTagsBatch(texts, {
    apiKey: context.env.OPENAI_API_KEY,
  });

  // Update chunks with tags
  tagsBatch.forEach((tags, idx) => {
    const chunk = batch[idx];
    if (!chunk) {
      return;
    }
    chunk.tags = tags;
    chunk.status = 'tags_done';
  });

  context.state.tagsBatchIndex++;

  // Re-execute current step for next batch (save state but don't advance)
  await context.next({ continueCurrentStep: true });
}
