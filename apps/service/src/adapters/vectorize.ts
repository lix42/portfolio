/**
 * Vectorize Adapter
 * Pure functions for vector similarity search
 */

export interface VectorMatch {
  id: string; // vectorize_id (format: "r2Key:chunkIndex")
  score: number; // similarity score (0-1)
  metadata: {
    r2Key: string;
    chunkIndex: number;
    text: string; // preview (first 500 chars)
  };
}

/**
 * Query Vectorize index by embedding vector
 * Returns top-K most similar vectors
 */
export async function queryByEmbedding(
  embedding: readonly number[],
  vectorize: VectorizeIndex,
  topK = 10,
): Promise<VectorMatch[]> {
  const result = await vectorize.query(Array.from(embedding), {
    topK,
    returnMetadata: "indexed", // Faster than 'all'
  });

  return (result.matches || []).map((match) => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata as VectorMatch["metadata"],
  }));
}

/**
 * Extract r2Key and chunkIndex from vectorize_id
 * Format: "r2Key:chunkIndex"
 */
export function parseVectorizeId(vectorizeId: string): {
  r2Key: string;
  chunkIndex: number;
} | null {
  const parts = vectorizeId.split(":");
  if (parts.length < 2) {
    return null;
  }

  const lastPart = parts[parts.length - 1];
  if (!lastPart) {
    return null;
  }

  const chunkIndex = Number.parseInt(lastPart, 10);
  const r2Key = parts.slice(0, -1).join(":");

  if (Number.isNaN(chunkIndex)) {
    return null;
  }

  return { r2Key, chunkIndex };
}
