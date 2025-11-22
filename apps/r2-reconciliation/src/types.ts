/**
 * Result of a reconciliation run
 */
export interface ReconciliationResult {
  /** Total markdown files checked in R2 */
  checked: number;
  /** Documents queued for processing (not_started or failed) */
  queued: number;
  /** Stuck documents that were retried (processing > 24h) */
  retried: number;
  /** Documents already processed (in D1 or currently processing) */
  skipped: number;
}

/**
 * Processing status from Durable Object
 * Matches the response from document-processor's /status endpoint
 */
export interface ProcessingStatus {
  status: 'not_started' | 'processing' | 'completed' | 'failed';
  currentStep: 'download' | 'embeddings' | 'tags' | 'store' | 'complete';
  progress: {
    totalChunks: number;
    processedChunks: number;
    percentage: number;
  };
  errors: Array<{
    step: string;
    error: string;
    timestamp: string;
    retryable: boolean;
  }>;
  timing: {
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    duration?: number;
  };
  documentId?: number;
}
