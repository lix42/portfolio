/**
 * @portfolio/shared
 *
 * Shared business logic and utilities for Portfolio RAG Assistant
 */

// Constants
export {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  TAG_GENERATION_MODEL,
  ANSWER_GENERATION_MODEL,
  MAX_CHUNK_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  VECTOR_SEARCH_TOP_K,
  TAG_MATCH_LIMIT,
  EMBEDDING_BATCH_SIZE,
  TAG_BATCH_SIZE,
  MAX_RETRY_ATTEMPTS,
  RETRY_BACKOFF_MS,
  CHARS_PER_TOKEN,
  estimateTokens,
  exceedsTokenLimit,
} from './constants';

// Chunking
export type { Chunk, ChunkOptions } from './chunking';
export { chunkMarkdown } from './chunking';

// Embeddings
export type { EmbeddingOptions } from './embeddings';
export {
  cosineSimilarity,
  generateEmbedding,
  generateEmbeddingsBatch,
} from './embeddings';

// Tags
export type { TagGenerationOptions } from './tags';
export {
  generateTags,
  generateTagsBatch,
  normalizeTag,
  parseTags,
} from './tags';
