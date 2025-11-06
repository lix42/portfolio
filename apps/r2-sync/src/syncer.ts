import type { LocalFile, R2Object, SyncDiff, SyncOptions, SyncResult, FileOperation } from './types.js';
import { listFiles, type ScanConfig } from './local-files.js';
import { R2Client } from './r2-client.js';
import { validateDocuments } from './validation.js';

/**
 * Main sync function - functional approach
 */
export async function sync(r2Client: R2Client, options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    // 1. List local files
    const scanConfig: ScanConfig = {
      documentsPath: options.documentsPath,
    };
    const localFiles = await listFiles(scanConfig);

    // 2. Validate documents (JSON schema + markdown linking)
    const validation = await validateDocuments(localFiles);
    if (!validation.valid && !options.ci) {
      // Log validation warnings in interactive mode
      console.log('⚠️  Validation warnings:');
      validation.errors.forEach((err) => {
        console.log(`  - ${err.file}: ${err.error}`);
      });
      console.log();
    }

    // 3. List R2 objects
    const r2Objects = await r2Client.listObjects();

    // 4. Compute diff
    const diff = computeDiff(localFiles, r2Objects, options);

    // 5. Dry run or execute
    if (options.dryRun) {
      return createDryRunResult(diff, startTime);
    }

    // 6. Execute sync operations
    return await executeSync(diff, r2Client, options, startTime);
  } catch (error) {
    const errorOp: FileOperation = {
      path: 'system',
      operation: 'upload',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };

    return {
      success: false,
      operations: [errorOp],
      summary: {
        uploaded: 0,
        deleted: 0,
        unchanged: 0,
        failed: 1,
      },
      duration: Date.now() - startTime,
    };
  }
}

function computeDiff(local: LocalFile[], remote: R2Object[], options: SyncOptions): SyncDiff {
  const toUpload: LocalFile[] = [];
  const toDelete: R2Object[] = [];
  const unchanged: LocalFile[] = [];

  // Build a map for fast lookup
  const remoteMap = new Map(remote.map((obj) => [obj.key, obj]));

  // Find files to upload (new or modified)
  for (const file of local) {
    const remoteObj = remoteMap.get(file.path);

    if (!remoteObj) {
      // New file
      toUpload.push(file);
    } else if (remoteObj.contentHash !== file.hash) {
      // Modified file (hash mismatch)
      toUpload.push(file);
    } else {
      // Unchanged
      unchanged.push(file);
    }

    // Remove from map (remaining items will be deleted)
    remoteMap.delete(file.path);
  }

  // Files remaining in remoteMap exist in R2 but not locally
  if (options.allowDelete) {
    toDelete.push(...remoteMap.values());
  }

  return { toUpload, toDelete, unchanged };
}

async function executeSync(
  diff: SyncDiff,
  r2Client: R2Client,
  options: SyncOptions,
  startTime: number
): Promise<SyncResult> {
  const operations: FileOperation[] = [];

  // Upload files with detailed logging
  for (const file of diff.toUpload) {
    logOperation('upload', file.path, options, file.size);

    const result = await r2Client.uploadFile(file.absolutePath, file.path, file.hash, options.maxRetries);

    operations.push(result);
    logResult(result, options);

    // Fail fast if requested
    if (result.status === 'failed' && options.failFast) {
      break;
    }
  }

  // Delete files with detailed logging
  if (!options.failFast || operations.every((op) => op.status === 'success')) {
    for (const obj of diff.toDelete) {
      logOperation('delete', obj.key, options);

      const result = await r2Client.deleteFile(obj.key, options.maxRetries);

      operations.push(result);
      logResult(result, options);

      if (result.status === 'failed' && options.failFast) {
        break;
      }
    }
  }

  // Calculate summary
  const summary = {
    uploaded: operations.filter((op) => op.operation === 'upload' && op.status === 'success').length,
    deleted: operations.filter((op) => op.operation === 'delete' && op.status === 'success').length,
    unchanged: diff.unchanged.length,
    failed: operations.filter((op) => op.status === 'failed').length,
  };

  return {
    success: summary.failed === 0,
    operations,
    summary,
    duration: Date.now() - startTime,
  };
}

function createDryRunResult(diff: SyncDiff, startTime: number): SyncResult {
  const operations: FileOperation[] = [
    ...diff.toUpload.map((file) => ({
      path: file.path,
      operation: 'upload' as const,
      status: 'success' as const,
      size: file.size,
    })),
    ...diff.toDelete.map((obj) => ({
      path: obj.key,
      operation: 'delete' as const,
      status: 'success' as const,
    })),
  ];

  return {
    success: true,
    operations,
    summary: {
      uploaded: diff.toUpload.length,
      deleted: diff.toDelete.length,
      unchanged: diff.unchanged.length,
      failed: 0,
    },
    duration: Date.now() - startTime,
  };
}

function logOperation(
  operation: 'upload' | 'delete',
  path: string,
  options: SyncOptions,
  size?: number
): void {
  // Skip detailed logs in CI mode
  if (options.ci) {
    return;
  }

  const timestamp = new Date().toISOString().split('T')[1]?.split('.')[0] ?? '00:00:00';
  const sizeStr = size ? ` (${formatBytes(size)})` : '';
  console.log(`[${timestamp}] ${operation === 'upload' ? 'Uploading' : 'Deleting'} ${path}${sizeStr}...`);
}

function logResult(result: FileOperation, options: SyncOptions): void {
  // CI mode: output JSON line
  if (options.ci) {
    console.log(JSON.stringify(result));
    return;
  }

  // Interactive mode: formatted output
  const timestamp = new Date().toISOString().split('T')[1]?.split('.')[0] ?? '00:00:00';
  const icon = result.status === 'success' ? '✓' : '✗';
  const durationStr = result.duration ? ` in ${result.duration}ms` : '';
  const retriesStr = result.retries && result.retries > 0 ? ` (${result.retries} retries)` : '';

  if (result.status === 'success') {
    console.log(`[${timestamp}] ${icon} ${result.operation}d${durationStr}${retriesStr}`);
  } else {
    console.log(`[${timestamp}] ${icon} Failed: ${result.error}${retriesStr}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
