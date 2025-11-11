/**
 * @portfolio/shared
 *
 * Shared business logic and utilities for Portfolio RAG Assistant
 */

// Prompts
export type { PreprocessQuestionResponse, PromptKey } from './prompts';
export {
  ANSWER_QUESTION_PROMPT,
  DEFINE_TAGS_PROMPT,
  PREPROCESS_QUESTION_PROMPT,
  PROMPTS,
} from './prompts';

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
