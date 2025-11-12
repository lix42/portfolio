import OpenAI from 'openai';

import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './constants';

export interface EmbeddingOptions {
  model?: string;
  apiKey?: string;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions,
  instance?: OpenAI
): Promise<number[]> {
  const openai = instance ?? new OpenAI({ apiKey: options.apiKey });

  const response = await openai.embeddings.create({
    model: options.model ?? EMBEDDING_MODEL,
    input: text,
  });

  const embedding = response.data[0]?.embedding ?? [];

  // Validate dimensions
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`
    );
  }

  return embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch
 * More efficient than individual requests
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: EmbeddingOptions,
  instance?: OpenAI
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const openai = instance ?? new OpenAI({ apiKey: options.apiKey });

  const response = await openai.embeddings.create({
    model: options.model ?? EMBEDDING_MODEL,
    input: texts,
  });

  // Validate all embeddings have correct dimensions
  const embeddings = response.data.map((d) => d.embedding);
  embeddings.forEach((emb, idx) => {
    if (emb.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding ${idx} has ${emb.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`
      );
    }
  });

  return embeddings;
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 and 1 (higher is more similar)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const numA = a[i];
    const numB = b[i];
    if (numA === undefined || numB === undefined) {
      continue;
    }
    dotProduct += numA * numB;
    normA += numA * numA;
    normB += numB * numB;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
