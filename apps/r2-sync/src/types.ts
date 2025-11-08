export interface SyncOptions {
  documentsPath: string;
  dryRun: boolean;
  allowDelete: boolean;
  ci: boolean;
  json: boolean;
  failFast: boolean;
  filePattern?: string;
  maxRetries: number;
}

export interface LocalFile {
  path: string;          // Relative path: "experiments/webforms.md"
  absolutePath: string;  // Full path on disk
  hash: string;          // SHA-256 hash
  size: number;          // File size in bytes
  type: 'markdown' | 'json';
}

export interface R2Object {
  key: string;           // R2 object key
  contentHash: string;   // SHA-256 from metadata
  size: number;
  lastModified: Date;
}

export interface SyncDiff {
  toUpload: LocalFile[];
  toDelete: R2Object[];
  unchanged: LocalFile[];
}

export interface FileOperation {
  path: string;
  operation: 'upload' | 'delete';
  status: 'success' | 'failed';
  error?: string;
  size?: number;
  duration?: number;  // milliseconds
  retries?: number;   // number of retry attempts
}

export interface SyncResult {
  success: boolean;  // true only if ALL operations succeeded
  operations: FileOperation[];  // Detailed per-file results
  summary: {
    uploaded: number;
    deleted: number;
    unchanged: number;
    failed: number;
  };
  duration: number;  // milliseconds
}
