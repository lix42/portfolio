import type { ChunkState, DocumentState } from "../types";

/**
 * Insert vectors into Vectorize (idempotent)
 */
export async function insertIntoVectorize(
  state: DocumentState,
  chunks: ChunkState[],
  vectorize: VectorizeIndex,
): Promise<void> {
  const vectors = chunks
    .map((chunk) => {
      if (!chunk.embedding) {
        throw new Error(`Chunk ${chunk.index} missing embedding`);
      }
      return {
        id: `${state.r2Key}:${chunk.index}`,
        values: chunk.embedding,
        metadata: {
          r2Key: state.r2Key,
          chunkIndex: chunk.index,
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
    `[${state.r2Key}] Inserted ${vectors.length} vectors into Vectorize`,
  );
}
