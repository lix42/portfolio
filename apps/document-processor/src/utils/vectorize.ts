import type { ProcessingState } from '../types';

/**
 * Insert vectors into Vectorize (idempotent)
 */
export async function insertIntoVectorize(
  state: ProcessingState,
  vectorize: VectorizeIndex
): Promise<void> {
  const vectors = state.chunks
    .map((chunk, idx) => {
      if (!chunk.embedding) {
        throw new Error(`Chunk ${idx} missing embedding`);
      }
      return {
        id: `${state.r2Key}:${idx}`,
        values: chunk.embedding,
        metadata: {
          r2Key: state.r2Key,
          chunkIndex: idx,
          text: chunk.text.substring(0, 500), // Store preview
        },
      };
    })
    .filter(Boolean);

  // Insert in batches (Vectorize supports up to 1000 per request)
  const VECTORIZE_BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += VECTORIZE_BATCH_SIZE) {
    const batch = vectors.slice(i, i + VECTORIZE_BATCH_SIZE);
    await vectorize.upsert(batch);
  }

  console.log(
    `[${state.r2Key}] Inserted ${vectors.length} vectors into Vectorize`
  );
}
