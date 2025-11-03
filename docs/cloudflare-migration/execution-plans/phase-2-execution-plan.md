# Phase 2 Execution Plan: R2 Sync Client

**Version**: 1.0
**Created**: 2025-11-03
**Status**: Ready to Execute
**Estimated Duration**: 1 week

---

## Overview

Phase 2 implements the R2 Sync Client, a CLI tool that synchronizes local documents (both `.md` markdown files and `.json` metadata files) from the `documents/experiments/` folder to Cloudflare R2 buckets. This enables automated document deployment and serves as the foundation for the document processing pipeline.

### Goals

1. Build a production-ready CLI tool for syncing documents to R2
2. Implement content-based change detection using SHA-256 hashing
3. Support both interactive (development) and CI/CD modes
4. Automate document sync in GitHub Actions
5. Handle partial failures with detailed per-file error reporting

### Prerequisites

✅ Phase 1 complete (infrastructure created)
✅ R2 buckets created (`portfolio-documents-dev`, `-staging`, `-prod`)
✅ Cloudflare API token with R2 Edit permissions
✅ Local `documents/experiments/` folder with markdown and JSON files

---

## Task 1: Project Structure Setup

**Goal**: Initialize the R2 sync package with TypeScript configuration

### Task 1.1: Create Package Directory

```bash
# From repo root
mkdir -p apps/r2-sync/src
cd apps/r2-sync
```

**Verification**:
```bash
ls -la
# Should show: src/
```

### Task 1.2: Initialize Package Configuration

**File**: `apps/r2-sync/package.json`

```json
{
  "name": "@portfolio/r2-sync",
  "version": "1.0.0",
  "description": "CLI tool to sync documents to Cloudflare R2",
  "type": "module",
  "bin": {
    "r2-sync": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "sync": "node ./dist/cli.js",
    "sync:dev": "node ./dist/cli.js --env dev",
    "sync:staging": "node ./dist/cli.js --env staging",
    "sync:prod": "node ./dist/cli.js --env production",
    "test": "vitest",
    "lint": "biome check ."
  },
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "@aws-sdk/client-s3": "^3.504.0",
    "@aws-sdk/lib-storage": "^3.504.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

**Rationale**:
- `commander` - CLI framework with argument parsing
- `chalk` - Terminal colors for interactive mode
- `@aws-sdk/*` - R2 is S3-compatible, use AWS SDK
- Separate scripts for each environment

### Task 1.3: TypeScript Configuration

**File**: `apps/r2-sync/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Task 1.4: Install Dependencies

```bash
cd apps/r2-sync
pnpm install
```

**Verification**:
```bash
ls node_modules | grep -E "(commander|chalk|@aws-sdk)"
# Should show all dependencies
```

### Task 1.5: Add Workspace Reference

Update root `package.json` to ensure workspace includes `apps/r2-sync`.

**Verification**:
```bash
pnpm list --depth 0 | grep r2-sync
# Should show: @portfolio/r2-sync 1.0.0
```

---

## Task 2: Core Logic Implementation

**Goal**: Implement SHA-256 hashing, file listing, and diff computation with detailed error tracking

### Task 2.1: Type Definitions

**File**: `apps/r2-sync/src/types.ts`

```typescript
export interface SyncOptions {
  env: 'dev' | 'staging' | 'production';
  dryRun: boolean;
  allowDelete: boolean;
  ci: boolean;
  json: boolean;
  failFast: boolean;
  exclude?: string[];
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
```

**Key Changes**:
- `FileOperation[]` provides detailed per-file tracking
- `status` field shows success/failed for each file
- `retries` tracks how many attempts were made
- `type` field distinguishes markdown vs JSON files

### Task 2.2: SHA-256 Hashing Utility

**File**: `apps/r2-sync/src/hash.ts`

```typescript
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * Compute SHA-256 hash of a file
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute SHA-256 hash of a buffer
 */
export function computeBufferHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
```

**Verification**:
```bash
# Create test
cat > src/hash.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { computeBufferHash } from './hash.js';

describe('computeBufferHash', () => {
  it('should compute SHA-256 hash', () => {
    const buffer = Buffer.from('hello world');
    const hash = computeBufferHash(buffer);
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
});
EOF

pnpm test
```

### Task 2.3: Local File Listing

**File**: `apps/r2-sync/src/local-files.ts`

```typescript
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { computeFileHash } from './hash.js';
import type { LocalFile } from './types.js';

export class LocalFileScanner {
  constructor(
    private documentsPath: string,
    private exclude: string[] = []
  ) {}

  /**
   * List all markdown and JSON files in documents/experiments/ folder
   */
  async listFiles(): Promise<LocalFile[]> {
    const files: LocalFile[] = [];
    await this.scanDirectory(this.documentsPath, files);
    return files;
  }

  private async scanDirectory(dir: string, files: LocalFile[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(this.documentsPath, fullPath);

      // Skip excluded patterns
      if (this.isExcluded(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, files);
      } else if (entry.isFile() && this.isDocumentFile(entry.name)) {
        const stats = await stat(fullPath);
        const hash = await computeFileHash(fullPath);

        files.push({
          path: relativePath,
          absolutePath: fullPath,
          hash,
          size: stats.size,
          type: this.getFileType(entry.name),
        });
      }
    }
  }

  private isDocumentFile(filename: string): boolean {
    return filename.endsWith('.md') || filename.endsWith('.json');
  }

  private getFileType(filename: string): 'markdown' | 'json' {
    return filename.endsWith('.json') ? 'json' : 'markdown';
  }

  private isExcluded(path: string): boolean {
    return this.exclude.some(pattern => {
      // Simple glob matching (can be enhanced with minimatch)
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(path);
      }
      return path === pattern;
    });
  }
}
```

**Key Changes**:
- Scans for **both `.md` and `.json` files** (not just markdown)
- `type` field distinguishes file types
- Maintains relative paths for R2 keys

### Task 2.4: R2 Client Integration

**File**: `apps/r2-sync/src/r2-client.ts`

```typescript
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { readFile } from 'node:fs/promises';
import type { R2Object, FileOperation } from './types.js';

export class R2Client {
  private r2: S3Client;  // Use 'r2' instead of 's3' for clarity
  private bucketName: string;

  constructor(accountId: string, accessKeyId: string, secretAccessKey: string, bucketName: string) {
    this.bucketName = bucketName;

    // R2 endpoint format
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.r2 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * List all objects in R2 bucket
   */
  async listObjects(): Promise<R2Object[]> {
    const objects: R2Object[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        ContinuationToken: continuationToken,
      });

      const response = await this.r2.send(command);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && obj.ETag && obj.Size !== undefined && obj.LastModified) {
            // Note: We'll store SHA-256 in metadata, ETag is MD5
            objects.push({
              key: obj.Key,
              contentHash: obj.ETag.replace(/"/g, ''), // Placeholder until metadata
              size: obj.Size,
              lastModified: obj.LastModified,
            });
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return objects;
  }

  /**
   * Upload file to R2 with retry logic
   */
  async uploadFile(
    localPath: string,
    r2Key: string,
    contentHash: string,
    maxRetries: number = 3
  ): Promise<FileOperation> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const fileContent = await readFile(localPath);
        const contentType = r2Key.endsWith('.json') ? 'application/json' : 'text/markdown';

        const upload = new Upload({
          client: this.r2,
          params: {
            Bucket: this.bucketName,
            Key: r2Key,
            Body: fileContent,
            ContentType: contentType,
            Metadata: {
              'sha256': contentHash,  // Store SHA-256 for comparison
            },
          },
        });

        await upload.done();

        return {
          path: r2Key,
          operation: 'upload',
          status: 'success',
          size: fileContent.length,
          duration: Date.now() - startTime,
          retries: attempt - 1,
        };
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const delay = 1000 * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      path: r2Key,
      operation: 'upload',
      status: 'failed',
      error: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime,
      retries: maxRetries,
    };
  }

  /**
   * Delete file from R2 with retry logic
   */
  async deleteFile(r2Key: string, maxRetries: number = 3): Promise<FileOperation> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: r2Key,
        });

        await this.r2.send(command);

        return {
          path: r2Key,
          operation: 'delete',
          status: 'success',
          duration: Date.now() - startTime,
          retries: attempt - 1,
        };
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      path: r2Key,
      operation: 'delete',
      status: 'failed',
      error: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime,
      retries: maxRetries,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Key Changes**:
- Renamed `s3` → `r2` for clarity
- Store SHA-256 hash in metadata (not just ETag)
- Built-in retry logic with exponential backoff
- Return `FileOperation` with detailed status
- Support both markdown and JSON content types

### Task 2.5: Diff Computation and Sync Logic

**File**: `apps/r2-sync/src/syncer.ts`

```typescript
import type { LocalFile, R2Object, SyncDiff, SyncOptions, SyncResult, FileOperation } from './types.js';
import { LocalFileScanner } from './local-files.js';
import { R2Client } from './r2-client.js';

export class R2Syncer {
  constructor(
    private documentsPath: string,
    private r2Client: R2Client,
    private options: SyncOptions
  ) {}

  async sync(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // 1. List local files
      const scanner = new LocalFileScanner(this.documentsPath, this.options.exclude);
      const localFiles = await scanner.listFiles();

      // 2. List R2 objects
      const r2Objects = await this.r2Client.listObjects();

      // 3. Compute diff
      const diff = this.computeDiff(localFiles, r2Objects);

      // 4. Dry run or execute
      if (this.options.dryRun) {
        return this.createDryRunResult(diff, startTime);
      }

      // 5. Execute sync operations
      return await this.executeSync(diff, startTime);

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

  private computeDiff(local: LocalFile[], remote: R2Object[]): SyncDiff {
    const toUpload: LocalFile[] = [];
    const toDelete: R2Object[] = [];
    const unchanged: LocalFile[] = [];

    // Build a map for fast lookup
    const remoteMap = new Map(remote.map(obj => [obj.key, obj]));

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
    if (this.options.allowDelete) {
      toDelete.push(...remoteMap.values());
    }

    return { toUpload, toDelete, unchanged };
  }

  private async executeSync(diff: SyncDiff, startTime: number): Promise<SyncResult> {
    const operations: FileOperation[] = [];

    // Upload files with detailed logging
    for (const file of diff.toUpload) {
      this.logOperation('upload', file.path, file.size);

      const result = await this.r2Client.uploadFile(
        file.absolutePath,
        file.path,
        file.hash,
        this.options.maxRetries
      );

      operations.push(result);
      this.logResult(result);

      // Fail fast if requested
      if (result.status === 'failed' && this.options.failFast) {
        break;
      }
    }

    // Delete files with detailed logging
    if (!this.options.failFast || operations.every(op => op.status === 'success')) {
      for (const obj of diff.toDelete) {
        this.logOperation('delete', obj.key);

        const result = await this.r2Client.deleteFile(obj.key, this.options.maxRetries);

        operations.push(result);
        this.logResult(result);

        if (result.status === 'failed' && this.options.failFast) {
          break;
        }
      }
    }

    // Calculate summary
    const summary = {
      uploaded: operations.filter(op => op.operation === 'upload' && op.status === 'success').length,
      deleted: operations.filter(op => op.operation === 'delete' && op.status === 'success').length,
      unchanged: diff.unchanged.length,
      failed: operations.filter(op => op.status === 'failed').length,
    };

    return {
      success: summary.failed === 0,
      operations,
      summary,
      duration: Date.now() - startTime,
    };
  }

  private createDryRunResult(diff: SyncDiff, startTime: number): SyncResult {
    const operations: FileOperation[] = [
      ...diff.toUpload.map(file => ({
        path: file.path,
        operation: 'upload' as const,
        status: 'success' as const,
        size: file.size,
      })),
      ...diff.toDelete.map(obj => ({
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

  private logOperation(operation: 'upload' | 'delete', path: string, size?: number): void {
    // Skip detailed logs in CI mode
    if (this.options.ci) {
      return;
    }

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const sizeStr = size ? ` (${this.formatBytes(size)})` : '';
    console.log(`[${timestamp}] ${operation === 'upload' ? 'Uploading' : 'Deleting'} ${path}${sizeStr}...`);
  }

  private logResult(result: FileOperation): void {
    // CI mode: output JSON line
    if (this.options.ci) {
      console.log(JSON.stringify(result));
      return;
    }

    // Interactive mode: formatted output
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const icon = result.status === 'success' ? '✓' : '✗';
    const durationStr = result.duration ? ` in ${result.duration}ms` : '';
    const retriesStr = result.retries && result.retries > 0 ? ` (${result.retries} retries)` : '';

    if (result.status === 'success') {
      console.log(`[${timestamp}] ${icon} ${result.operation}d${durationStr}${retriesStr}`);
    } else {
      console.log(`[${timestamp}] ${icon} Failed: ${result.error}${retriesStr}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
```

**Key Features**:
- Per-file operation tracking with `FileOperation[]`
- Built-in retry logic (delegated to R2Client)
- **CI mode**: JSON-lines output (one line per file)
- **Interactive mode**: Detailed logs with timestamps
- Fail-fast support stops on first error
- Clear success/failed status per file

**Verification**:
```bash
pnpm build
# Should compile without errors
```

---

## Task 3: CLI Interface Implementation

**Goal**: Create user-friendly CLI with Commander.js

### Task 3.1: Utility Functions

**File**: `apps/r2-sync/src/utils.ts`

```typescript
import chalk from 'chalk';
import type { SyncResult, SyncOptions } from './types.js';

export function displayResult(result: SyncResult, options: SyncOptions): void {
  // CI mode: output final summary as JSON
  if (options.ci) {
    const summary = {
      summary: result.summary,
      duration: result.duration,
      success: result.success,
    };
    console.log(JSON.stringify(summary));
    return;
  }

  // Interactive mode: formatted output
  console.log();

  if (options.dryRun) {
    console.log(chalk.cyan('🔍 Dry Run - Preview Changes:'));
  } else {
    console.log(result.success ? chalk.green('✓ Sync Complete') : chalk.red('✗ Sync Failed'));
  }

  console.log();
  console.log(`  Uploaded:  ${chalk.green(result.summary.uploaded)}`);
  console.log(`  Deleted:   ${chalk.red(result.summary.deleted)}`);
  console.log(`  Unchanged: ${chalk.gray(result.summary.unchanged)}`);
  console.log(`  Failed:    ${result.summary.failed > 0 ? chalk.red(result.summary.failed) : chalk.gray(result.summary.failed)}`);
  console.log(`  Duration:  ${(result.duration / 1000).toFixed(2)}s`);

  if (result.summary.failed > 0 && !options.ci) {
    console.log();
    console.log(chalk.red('Failed Operations:'));
    result.operations
      .filter(op => op.status === 'failed')
      .forEach(op => {
        console.log(chalk.red(`  ✗ ${op.path}: ${op.error}`));
      });
  }

  console.log();
}

export function loadConfig(env: string) {
  // Load from environment variables
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing required environment variables:\n' +
      '  - CLOUDFLARE_ACCOUNT_ID\n' +
      '  - R2_ACCESS_KEY_ID\n' +
      '  - R2_SECRET_ACCESS_KEY\n\n' +
      'See docs/cloudflare-migration/execution-plans/secrets-management.md'
    );
  }

  const bucketNames = {
    dev: 'portfolio-documents-dev',
    staging: 'portfolio-documents-staging',
    production: 'portfolio-documents-prod',
  };

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName: bucketNames[env as keyof typeof bucketNames],
  };
}
```

### Task 3.2: CLI Entry Point

**File**: `apps/r2-sync/src/cli.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { R2Syncer } from './syncer.js';
import { R2Client } from './r2-client.js';
import { displayResult, loadConfig } from './utils.js';
import type { SyncOptions } from './types.js';
import { resolve } from 'node:path';

const program = new Command();

program
  .name('r2-sync')
  .description('Sync local documents to Cloudflare R2')
  .version('1.0.0');

program
  .option('-e, --env <environment>', 'Environment (dev, staging, production)', 'dev')
  .option('--dry-run', 'Preview changes without executing', false)
  .option('--delete', 'Allow deletion of files not in local folder', false)
  .option('--ci', 'CI/CD mode (non-interactive, JSON output)', false)
  .option('--fail-fast', 'Exit on first error', false)
  .option('--exclude <patterns...>', 'Exclude file patterns')
  .option('--max-retries <number>', 'Maximum retry attempts per file', '3')
  .option('-f, --file <path>', 'Sync specific file')
  .action(async (options) => {
    try {
      await runSync(options);
    } catch (error) {
      if (options.ci) {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      } else {
        console.error('✗ Sync failed:', error);
      }
      process.exit(1);
    }
  });

async function runSync(cliOptions: any): Promise<void> {
  // Load configuration based on environment
  const config = loadConfig(cliOptions.env);

  // Build sync options
  const syncOptions: SyncOptions = {
    env: cliOptions.env,
    dryRun: cliOptions.dryRun,
    allowDelete: cliOptions.delete,
    ci: cliOptions.ci,
    json: cliOptions.ci, // Always use JSON in CI mode
    failFast: cliOptions.failFast,
    exclude: cliOptions.exclude,
    filePattern: cliOptions.file,
    maxRetries: parseInt(cliOptions.maxRetries, 10),
  };

  // Initialize R2 client
  const r2Client = new R2Client(
    config.accountId,
    config.accessKeyId,
    config.secretAccessKey,
    config.bucketName
  );

  // Get documents path (relative to repo root)
  const documentsPath = resolve(process.cwd(), '../../documents/experiments');

  // Run sync
  const syncer = new R2Syncer(documentsPath, r2Client, syncOptions);
  const result = await syncer.sync();

  // Output results
  displayResult(result, syncOptions);

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

program.parse();
```

**Key Features**:
- `--ci` flag enables non-interactive mode with JSON output
- `--max-retries` configurable retry attempts
- Proper exit codes (0 = success, 1 = failure)
- Environment-specific configuration

### Task 3.3: Add Root Scripts

**File**: `package.json` (root)

Add to `scripts`:
```json
{
  "scripts": {
    "sync:r2": "pnpm --filter @portfolio/r2-sync sync",
    "sync:r2:dev": "pnpm --filter @portfolio/r2-sync sync:dev",
    "sync:r2:staging": "pnpm --filter @portfolio/r2-sync sync:staging",
    "sync:r2:prod": "pnpm --filter @portfolio/r2-sync sync:prod"
  }
}
```

**Verification**:
```bash
pnpm build
pnpm sync:r2 --help
# Should show usage information
```

---

## Task 4: Testing

**Goal**: Ensure reliability with unit and integration tests

### Task 4.1: Unit Tests for Hash Function

Already created in Task 2.2

### Task 4.2: Unit Tests for File Scanner

**File**: `apps/r2-sync/src/local-files.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalFileScanner } from './local-files.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

describe('LocalFileScanner', () => {
  const testDir = '/tmp/r2-sync-test';

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, 'test.md'), '# Test');
    await writeFile(join(testDir, 'meta.json'), '{"test":true}');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should list both markdown and JSON files', async () => {
    const scanner = new LocalFileScanner(testDir);
    const files = await scanner.listFiles();

    expect(files).toHaveLength(2);
    expect(files.find(f => f.path === 'test.md')).toBeDefined();
    expect(files.find(f => f.path === 'meta.json')).toBeDefined();
  });

  it('should compute correct file types', async () => {
    const scanner = new LocalFileScanner(testDir);
    const files = await scanner.listFiles();

    const mdFile = files.find(f => f.path === 'test.md');
    const jsonFile = files.find(f => f.path === 'meta.json');

    expect(mdFile?.type).toBe('markdown');
    expect(jsonFile?.type).toBe('json');
  });
});
```

### Task 4.3: Integration Test Plan

Create mock R2 client for testing:

**File**: `apps/r2-sync/src/r2-client.mock.ts`

```typescript
import type { R2Object, FileOperation } from './types.js';

export class MockR2Client {
  private objects = new Map<string, R2Object>();

  async listObjects(): Promise<R2Object[]> {
    return Array.from(this.objects.values());
  }

  async uploadFile(path: string, key: string, hash: string): Promise<FileOperation> {
    this.objects.set(key, {
      key,
      contentHash: hash,
      size: 100,
      lastModified: new Date(),
    });

    return {
      path: key,
      operation: 'upload',
      status: 'success',
      size: 100,
      duration: 50,
      retries: 0,
    };
  }

  async deleteFile(key: string): Promise<FileOperation> {
    this.objects.delete(key);

    return {
      path: key,
      operation: 'delete',
      status: 'success',
      duration: 30,
      retries: 0,
    };
  }
}
```

### Task 4.4: Manual Testing

```bash
# Test with real R2 bucket (dev environment)
export CLOUDFLARE_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."

# Dry run first
pnpm sync:r2 --dry-run --env dev

# Verify output shows correct file counts (should see both .md and .json files)

# Then run actual sync
pnpm sync:r2 --env dev

# Check R2 bucket contains both markdown and JSON files
```

---

## Task 5: R2 API Token Generation

**Goal**: Create R2 API tokens for accessing buckets

### Task 5.1: Generate R2 API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **R2** in the sidebar
3. Click **Manage R2 API Tokens**
4. Click **Create API token**
5. Configure:
   - **Token name**: `r2-sync-documents`
   - **Permissions**: Admin Read & Write
   - **Buckets**: Select all three buckets or "All buckets"
   - **TTL**: Optional expiration
6. Click **Create API token**
7. **Copy the Access Key ID and Secret Access Key**

**Save credentials** for local testing:
```bash
# Add to .env or export
export R2_ACCESS_KEY_ID="your-access-key-id"
export R2_SECRET_ACCESS_KEY="your-secret-access-key"
export CLOUDFLARE_ACCOUNT_ID="70e742defbfbc3bbf6228e06626c7766"
```

### Task 5.2: Test R2 Access

```bash
# Test sync
pnpm sync:r2 --dry-run --env dev

# Should successfully list R2 objects (may be empty initially)
```

**Verification**: No authentication errors.

---

## Task 6: CI/CD Integration

**Goal**: Automate document sync on changes

### Task 6.1: Create GitHub Actions Workflow

**File**: `.github/workflows/sync-documents.yml`

```yaml
name: Sync Documents to R2

on:
  push:
    paths:
      - 'documents/**'
    branches:
      - main
      - staging
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    name: Sync documents to R2

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build R2 sync tool
        run: pnpm --filter @portfolio/r2-sync build

      - name: Sync to dev (staging branch)
        if: github.ref == 'refs/heads/staging'
        run: pnpm sync:r2 --ci --env dev
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}

      - name: Sync to production (main branch)
        if: github.ref == 'refs/heads/main'
        run: pnpm sync:r2 --ci --env production
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
```

**Output in GitHub Actions**: JSON-lines format, one line per file:
```
{"file":"experiments/webforms.md","operation":"upload","status":"success","size":10240,"duration":234}
{"file":"experiments/webforms.json","operation":"upload","status":"success","size":84,"duration":156}
{"summary":{"uploaded":2,"deleted":0,"unchanged":5,"failed":0},"duration":1245,"success":true}
```

### Task 6.2: Add GitHub Secrets

Go to repository settings → Secrets and variables → Actions:

1. `R2_ACCESS_KEY_ID` - From Task 5.1
2. `R2_SECRET_ACCESS_KEY` - From Task 5.1
3. `CLOUDFLARE_ACCOUNT_ID` - Already added in Phase 1

### Task 6.3: Test Workflow

```bash
# Make a change to a document
echo "# Test Update" >> documents/experiments/test.md

# Commit and push
git add documents/experiments/test.md
git commit -m "test: trigger R2 sync workflow"
git push

# Check GitHub Actions tab for workflow run
```

---

## Task 7: Documentation and Verification

**Goal**: Document usage and verify Phase 2 completion

### Task 7.1: Create README

**File**: `apps/r2-sync/README.md`

```markdown
# R2 Sync Client

CLI tool to synchronize local documents to Cloudflare R2 buckets.

## Features

- Content-based sync using SHA-256 hashing
- Syncs both markdown (`.md`) and metadata (`.json`) files
- Automatic retry with exponential backoff
- Interactive mode with detailed logging
- CI/CD mode with JSON-lines output
- Per-file operation tracking with partial failure support

## Usage

### Local Development

\`\`\`bash
# Preview changes
pnpm sync:r2 --dry-run --env dev

# Sync to dev environment
pnpm sync:r2 --env dev

# Sync with deletions enabled
pnpm sync:r2 --env dev --delete

# Fail fast (stop on first error)
pnpm sync:r2 --env dev --fail-fast
\`\`\`

### CI/CD Mode

\`\`\`bash
# Non-interactive mode with JSON output
pnpm sync:r2 --ci --env production

# Each file operation outputs one JSON line
# Final summary as last line
\`\`\`

## Environment Variables

Required:
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 API token access key ID
- `R2_SECRET_ACCESS_KEY` - R2 API token secret

## Output Formats

### Interactive Mode
\`\`\`
[10:23:45] Uploading experiments/webforms.md (10.0 KB)...
[10:23:46] ✓ uploaded in 234ms
[10:23:46] Uploading experiments/webforms.json (84 B)...
[10:23:46] ✓ uploaded in 156ms

✓ Sync Complete
  Uploaded:  2
  Deleted:   0
  Unchanged: 5
  Failed:    0
  Duration:  1.25s
\`\`\`

### CI Mode (JSON Lines)
\`\`\`jsonl
{"path":"experiments/webforms.md","operation":"upload","status":"success","size":10240,"duration":234}
{"path":"experiments/webforms.json","operation":"upload","status":"success","size":84,"duration":156}
{"summary":{"uploaded":2,"deleted":0,"unchanged":5,"failed":0},"duration":1245,"success":true}
\`\`\`

## Configuration

See `docs/cloudflare-migration/execution-plans/secrets-management.md` for R2 API token setup.
```

### Task 7.2: Update Secrets Management Documentation

**File**: `docs/cloudflare-migration/execution-plans/secrets-management.md`

Add R2 section:

```markdown
## R2 API Tokens

For R2 sync client, you need separate R2 API tokens (not the Cloudflare API token).

### Creating R2 API Token

1. Go to https://dash.cloudflare.com → R2
2. Click "Manage R2 API Tokens"
3. Click "Create API token"
4. Configure:
   - Name: `r2-sync-documents`
   - Permissions: Admin Read & Write
   - Buckets: All buckets (or select specific ones)
5. Copy Access Key ID and Secret Access Key

### Local Development

Add to `.env` or export:
\`\`\`bash
export R2_ACCESS_KEY_ID="your-access-key-id"
export R2_SECRET_ACCESS_KEY="your-secret-access-key"
\`\`\`

### GitHub Actions

Add these repository secrets:
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
```

### Task 7.3: Create Verification Script

**File**: `scripts/verify-phase-2.sh`

```bash
#!/bin/bash
# Phase 2 Verification Script

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 2: R2 Sync Client Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check() {
  local name=$1
  local command=$2

  echo -n "Checking $name... "
  if eval "$command" &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

# 1. Check package structure
echo "1️⃣  Package Structure"
check "r2-sync package exists" "test -d apps/r2-sync"
check "package.json exists" "test -f apps/r2-sync/package.json"
check "TypeScript config exists" "test -f apps/r2-sync/tsconfig.json"
check "Source files exist" "test -d apps/r2-sync/src"
check "README exists" "test -f apps/r2-sync/README.md"
echo ""

# 2. Check dependencies
echo "2️⃣  Dependencies"
check "commander installed" "test -d apps/r2-sync/node_modules/commander"
check "chalk installed" "test -d apps/r2-sync/node_modules/chalk"
check "@aws-sdk/client-s3 installed" "test -d apps/r2-sync/node_modules/@aws-sdk/client-s3"
echo ""

# 3. Check build
echo "3️⃣  Build"
check "Can build package" "cd apps/r2-sync && pnpm build"
check "CLI executable exists" "test -f apps/r2-sync/dist/cli.js"
check "All source files compiled" "test -f apps/r2-sync/dist/syncer.js && test -f apps/r2-sync/dist/r2-client.js"
echo ""

# 4. Check CLI
echo "4️⃣  CLI Interface"
check "CLI runs --help" "cd apps/r2-sync && node dist/cli.js --help"
check "Root sync:r2 script works" "pnpm sync:r2 --help"
echo ""

# 5. Check GitHub Actions
echo "5️⃣  CI/CD"
check "Sync workflow exists" "test -f .github/workflows/sync-documents.yml"
echo ""

# 6. Check documentation
echo "6️⃣  Documentation"
check "Secrets management updated" "grep -q 'R2 API' docs/cloudflare-migration/execution-plans/secrets-management.md"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 2 Verification Complete - All checks passed!${NC}"
  echo ""
  echo "🎉 R2 Sync Client ready!"
  echo ""
  echo "Next Steps:"
  echo "  1. Generate R2 API token (see secrets-management.md)"
  echo "  2. Run: pnpm sync:r2 --dry-run --env dev"
  echo "  3. Run: pnpm sync:r2 --env dev"
  echo ""
  echo "Ready to proceed to Phase 3: Shared Package"
else
  echo -e "${RED}❌ Phase 2 Verification Failed - $ERRORS error(s) found${NC}"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

Make executable:
```bash
chmod +x scripts/verify-phase-2.sh
```

### Task 7.4: Run Verification

```bash
./scripts/verify-phase-2.sh
```

**Expected**: All checks pass ✅

### Task 7.5: Update Implementation Plan

Mark Phase 2 tasks as complete in `docs/cloudflare-migration/02-implementation-plan.md`.

---

## Completion Checklist

Before marking Phase 2 complete, verify:

- [ ] R2 sync package created and builds successfully
- [ ] Core sync logic implemented (hash, list, diff, upload, delete)
- [ ] Both `.md` and `.json` files are synced
- [ ] Retry logic with exponential backoff working
- [ ] CLI interface functional with interactive and CI modes
- [ ] CI mode outputs JSON-lines (one line per file)
- [ ] Unit tests passing
- [ ] Manual testing successful with real R2 bucket
- [ ] R2 API tokens generated and configured
- [ ] GitHub Actions workflow created and tested
- [ ] Documentation updated (README, secrets management)
- [ ] Verification script passing
- [ ] All documents synced to R2 dev bucket

---

## Troubleshooting

### Issue: "Missing required environment variables"

**Solution**: Ensure these are set:
```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
```

### Issue: "Access Denied" when listing R2 objects

**Solution**:
1. Verify R2 API token has correct permissions (Admin Read & Write)
2. Check bucket name matches environment configuration
3. Verify account ID is correct

### Issue: All files re-upload on every sync

**Possible Causes**:
1. R2 ETag doesn't match SHA-256 (it's MD5)
2. Metadata not being stored correctly

**Solution**: Verify SHA-256 is stored in R2 object metadata and being read correctly in `listObjects()`.

### Issue: Retry logic not working

**Debug**:
```bash
# Enable verbose logging
pnpm sync:r2 --env dev --max-retries 5
# Watch for retry messages in output
```

### Issue: JSON files not being uploaded

**Solution**: Check `isDocumentFile()` method includes `.json` extension.

---

## Next Phase

After Phase 2 completion:
- **Phase 3**: Create shared package for common utilities (prompts, types)
- **Phase 4**: Implement Document Processor with Durable Objects

See `docs/cloudflare-migration/02-implementation-plan.md` for full timeline.
