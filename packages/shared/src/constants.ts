/**
 * Shared constants for document processing and query service
 */

// OpenAI Configuration
export const EMBEDDING_MODEL = 'text-embedding-3-small' as const;
export const EMBEDDING_DIMENSIONS = 1536;
export const TAG_GENERATION_MODEL = 'gpt-4o' as const;
export const ANSWER_GENERATION_MODEL = 'gpt-4o' as const;

// Chunking Configuration
export const MAX_CHUNK_TOKENS = 800;
export const CHUNK_OVERLAP_TOKENS = 100;

// Search Configuration
export const VECTOR_SEARCH_TOP_K = 5;
export const TAG_MATCH_LIMIT = 5;

// Processing Batch Sizes (for Durable Objects)
export const EMBEDDING_BATCH_SIZE = 10; // chunks per batch
export const TAG_BATCH_SIZE = 5; // chunks per batch

// Retry Configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = 1000; // base delay for exponential backoff

// Token Estimation
export const CHARS_PER_TOKEN = 4; // rough estimate: 1 token ≈ 4 characters

/**
 * Estimate token count from text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Check if text exceeds token limit
 */
export function exceedsTokenLimit(
  text: string,
  limit: number = MAX_CHUNK_TOKENS
): boolean {
  return estimateTokens(text) > limit;
}
