import {
  EMBEDDING_BATCH_SIZE,
  generateEmbeddingsBatch,
} from '@portfolio/shared';

import type { StepContext } from '../types';

/**
 * Step 2: Generate embeddings in batches
 * Uses self-continuation pattern: processes one batch, then calls next() to continue
 */
export async function stepGenerateEmbeddingsBatch(
  context: StepContext
): Promise<void> {
  console.log(
    `[${context.state.r2Key}] Step 2: Generate embeddings batch ${context.state.embeddingBatchIndex}`
  );

  // Get chunks that need embeddings
  const pendingChunks = context.state.chunks.filter(
    (c) => c.embedding === null
  );

  if (pendingChunks.length === 0) {
    // All embeddings done, advance to next step in pipeline
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
    throw new Error('No embeddings returned from OpenAI');
  }

  // Update chunks with embeddings
  embeddings.forEach((embedding, idx) => {
    const chunk = batch[idx];
    if (!chunk) {
      console.error('Chunk not found, index:', idx);
      return;
    }
    chunk.embedding = embedding;
    chunk.status = 'embedding_done';
  });

  context.state.embeddingBatchIndex++;

  // Re-execute current step for next batch (save state but don't advance)
  await context.next({ continueCurrentStep: true });
}
