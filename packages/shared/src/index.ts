/**
 * @portfolio/shared
 *
 * Shared business logic and utilities for Portfolio RAG Assistant
 */

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
} from './constants';
// Prompts
export type { PreprocessQuestionResponse, PromptKey } from './prompts';
export {
  ANSWER_QUESTION_PROMPT,
  DEFINE_TAGS_PROMPT,
  PREPROCESS_QUESTION_PROMPT,
  PROMPTS,
} from './prompts';
