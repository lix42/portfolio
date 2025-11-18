// Import auto-generated Env from worker-configuration.d.ts
// (Env is globally available after wrangler types)

/**
 * Queue message format
 */
export interface ProcessingMessage {
  r2Key: string;
  event?: 'upload' | 'update' | 'delete';
  timestamp?: string;
}

/**
 * Document metadata for processing (extends shared DocumentMetadata)
 * Includes R2 key and content hash for tracking
 */
export interface ProcessingDocumentMetadata {
  project: string;
  company: string;
  r2Key: string;
  contentHash: string;
}

/**
 * Processing state stored in Durable Object
 */
export interface ProcessingState {
  // Status
  status: 'not_started' | 'processing' | 'completed' | 'failed';
  r2Key: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  // Current execution
  currentStep: 'download' | 'embeddings' | 'tags' | 'store' | 'complete';

  // Document data
  metadata?: ProcessingDocumentMetadata;
  content?: string;
  documentTags?: string[];

  // Chunks
  chunks: ProcessingChunk[];
  totalChunks: number;
  processedChunks: number;

  // Batch processing indices
  embeddingBatchIndex: number;
  tagsBatchIndex: number;

  // Error handling
  errors: ProcessingError[];
  retryCount: number;

  // Results
  documentId?: number;
}

/**
 * Individual chunk being processed
 */
export interface ProcessingChunk {
  index: number;
  text: string;
  tokens: number;
  embedding: number[] | null;
  tags: string[] | null;
  status: 'pending' | 'embedding_done' | 'tags_done' | 'stored';
}

/**
 * Processing error record
 */
export interface ProcessingError {
  step: string;
  error: string;
  timestamp: string;
  retryable: boolean;
}

/**
 * Status response for API queries
 */
export interface ProcessingStatus {
  status: ProcessingState['status'];
  currentStep: ProcessingState['currentStep'];
  progress: {
    totalChunks: number;
    processedChunks: number;
    percentage: number;
  };
  errors: ProcessingError[];
  timing: {
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    duration?: number; // milliseconds
  };
  documentId?: number;
}

/**
 * Context object passed to each step handler
 * Provides access to all necessary resources and operations
 */
export interface StepContext {
  // State management
  state: ProcessingState;

  // Storage operations
  storage: {
    get: <T>(key: string) => Promise<T | undefined>;
    put: (key: string, value: unknown) => Promise<void>;
    setAlarm: (scheduledTime: number) => Promise<void>;
  };

  // Environment bindings
  env: {
    DOCUMENTS_BUCKET: R2Bucket;
    DB: D1Database;
    VECTORIZE: VectorizeIndex;
    OPENAI_API_KEY: string;
  };

  // Orchestration control
  next: (options?: { continueCurrentStep?: boolean }) => Promise<void>;
  fail: (error: unknown) => Promise<void>;
}

/**
 * Step handler function signature
 * Returns void - uses context.next() to control flow
 */
export type StepHandler = (context: StepContext) => Promise<void>;

/**
 * Step registration entry
 */
export interface StepRegistration {
  name: ProcessingState['currentStep'];
  handler: StepHandler;
  nextStep: ProcessingState['currentStep'];
  description?: string;
}
