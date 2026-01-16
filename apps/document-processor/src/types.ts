// Import auto-generated Env from worker-configuration.d.ts
// (Env is globally available after wrangler types)

/**
 * Queue message format
 */
export interface ProcessingMessage {
  r2Key: string;
  event?: "upload" | "update" | "delete";
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
 * Processing step type
 */
export type ProcessingStep =
  | "download"
  | "embeddings"
  | "tags"
  | "store"
  | "complete";

/**
 * Document state stored in Durable Object (key: 'state')
 * Metadata and progress tracking only - chunks stored separately
 */
export interface DocumentState {
  // Status
  status: "not_started" | "processing" | "completed" | "failed";
  r2Key: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  // Current execution
  currentStep: ProcessingStep;

  // Document data (no content - fetch from R2 if needed)
  metadata?: ProcessingDocumentMetadata;
  documentTags?: string[];

  // Chunk tracking (chunks stored separately)
  totalChunks: number;
  processedChunks: number;

  // Error handling
  errors: ProcessingError[];
  retryCount: number;

  // Results
  documentId?: number;
}

/**
 * Chunk state stored in Durable Object (key: 'chunk:{index}')
 * Each chunk is stored separately to avoid 128KB limit
 */
export interface ChunkState {
  index: number;
  text: string;
  tokens: number;
  embedding: number[] | null;
  tags: string[] | null;
  status: "pending" | "embedding_done" | "tags_done" | "stored";
}

/**
 * @deprecated Use DocumentState + ChunkState instead
 * Kept for backwards compatibility during migration
 */
export interface ProcessingState {
  // Status
  status: "not_started" | "processing" | "completed" | "failed";
  r2Key: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  // Current execution
  currentStep: ProcessingStep;

  // Document data
  metadata?: ProcessingDocumentMetadata;
  content?: string;
  documentTags?: string[];

  // Chunks
  chunks: ProcessingChunk[];
  totalChunks: number;
  processedChunks: number;

  // Error handling
  errors: ProcessingError[];
  retryCount: number;

  // Results
  documentId?: number;
}

/**
 * @deprecated Use ChunkState instead
 * Kept for backwards compatibility during migration
 */
export interface ProcessingChunk {
  index: number;
  text: string;
  tokens: number;
  embedding: number[] | null;
  tags: string[] | null;
  status: "pending" | "embedding_done" | "tags_done" | "stored";
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
  status: DocumentState["status"];
  currentStep: DocumentState["currentStep"];
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
 * Chunk storage operations for step handlers
 */
export interface ChunkStorage {
  getChunk: (index: number) => Promise<ChunkState | undefined>;
  saveChunk: (chunk: ChunkState) => Promise<void>;
  saveChunks: (chunks: ChunkState[]) => Promise<void>;
  getChunksByStatus: (status: ChunkState["status"]) => Promise<ChunkState[]>;
  getAllChunks: () => Promise<ChunkState[]>;
}

/**
 * Context object passed to each step handler
 * Provides access to all necessary resources and operations
 */
export interface StepContext {
  // Document state management (metadata and progress only)
  state: DocumentState;

  // Chunk storage operations (chunks stored separately)
  chunks: ChunkStorage;

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
  name: ProcessingStep;
  handler: StepHandler;
  nextStep: ProcessingStep;
  description?: string;
}
