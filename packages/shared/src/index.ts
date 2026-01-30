/**
 * @portfolio/shared
 *
 * Shared business logic and utilities for Portfolio RAG Assistant
 */

// Utils
export { mapLimit } from "./asyncWorker";

// Chunking
export type { Chunk, ChunkOptions } from "./chunking";
export { chunkMarkdown } from "./chunking";
// Constants
export {
  ANSWER_GENERATION_MODEL,
  CHARS_PER_TOKEN,
  CHUNK_OVERLAP_TOKENS,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  estimateTokens,
  exceedsTokenLimit,
  MAX_CHUNK_TOKENS,
  MAX_RETRY_ATTEMPTS,
  RETRY_BACKOFF_MS,
  TAG_BATCH_SIZE,
  TAG_GENERATION_MODEL,
  TAG_MATCH_LIMIT,
  VECTOR_SEARCH_TOP_K,
} from "./constants";
// Embeddings
export type { EmbeddingOptions } from "./embeddings";
export {
  cosineSimilarity,
  generateEmbedding,
  generateEmbeddingsBatch,
} from "./embeddings";
export type { PreprocessQuestionResponse, PromptKey } from "./prompts";
// Prompts
export {
  ANSWER_QUESTION_PROMPT,
  DEFINE_TAGS_PROMPT,
  PREPROCESS_QUESTION_PROMPT,
  PROMPTS,
} from "./prompts";
// Schemas
export type {
  ChatErrorResponse,
  ChatRequest,
  ChatResponse,
  ChatSuccessResponse,
  DocumentMetadata,
  HealthResponse,
  SyncOptions,
} from "./schemas";
export {
  ChatErrorResponseSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  ChatSuccessResponseSchema,
  documentMetadataSchema,
  healthResponseSchema,
  isErrorChat,
  isSuccessChat,
  syncOptionsSchema,
  validateDocumentMetadata,
} from "./schemas";
// Tags
export type { TagGenerationOptions } from "./tags";
export {
  generateTags,
  generateTagsBatch,
  normalizeTag,
  parseTags,
} from "./tags";
