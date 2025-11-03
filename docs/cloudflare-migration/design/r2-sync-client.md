# R2 Sync Client Design

**Component**: Document Synchronization CLI Tool
**Location**: `apps/r2-sync/`
**Dependencies**: Wrangler, Commander.js

---

## Overview

The R2 Sync Client is a CLI tool that synchronizes the local `documents/` folder with the R2 bucket. It runs locally during development and in CI/CD pipelines for automated deployment.

### Responsibilities

- List local documents and R2 objects
- Compute diffs based on content hash (SHA-256)
- Upload new/modified files to R2
- Delete removed files from R2 (with confirmation)
- Trigger R2 event notifications for processing

---

## CLI Interface

```bash
# Interactive mode (local development)
pnpm sync:r2                    # Sync all changes
pnpm sync:r2 --dry-run          # Preview changes
pnpm sync:r2 --delete           # Allow deletions
pnpm sync:r2 --watch            # Watch mode for development

# CI/CD mode (automated pipelines)
pnpm sync:r2 --ci               # Non-interactive mode
pnpm sync:r2 --ci --json        # JSON output for parsing
pnpm sync:r2 --ci --fail-fast   # Exit on first error

# Specific file operations
pnpm sync:r2 --file experiments/webforms.md  # Sync specific file
pnpm sync:r2 --exclude "*.json"              # Exclude patterns
```

---

## Features

### 1. Content-Based Sync

Uses SHA-256 hashing to detect changes, not timestamps.

```typescript
async function computeHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### 2. Dry-Run Mode

Preview changes before executing:

```
Sync Plan:
  Upload: 3 files
    + documents/experiments/new-feature.md
    ~ documents/experiments/webforms.md (modified)
    + documents/companies.json

  Delete: 1 file
    - documents/old-project.md

Total: 3 uploads, 1 deletion
```

### 3. Progress Reporting

```
Syncing documents to R2...
[============================] 100% | 15/15 files | 2.3 MB | 5.2s
✓ Upload complete
```

### 4. CI/CD Integration

**GitHub Actions**:
```yaml
name: Sync Documents to R2

on:
  push:
    paths:
      - 'documents/**'
    branches:
      - main

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm sync:r2 --ci
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

## Implementation

### Structure

```
apps/r2-sync/
├── src/
│   ├── cli.ts           # Commander.js CLI
│   ├── syncer.ts        # Core sync logic
│   ├── hash.ts          # SHA-256 hashing
│   └── types.ts         # TypeScript types
├── package.json
└── tsconfig.json
```

### Core Logic

```typescript
export class R2Syncer {
  async sync(options: SyncOptions): Promise<SyncResult> {
    // 1. List local files
    const localFiles = await this.listLocalDocuments();

    // 2. List R2 objects
    const r2Objects = await this.listR2Objects();

    // 3. Compute diff
    const diff = await this.computeDiff(localFiles, r2Objects);

    // 4. Execute operations (or dry-run)
    if (options.dryRun) {
      return this.previewChanges(diff);
    }

    return await this.executeSync(diff, options);
  }

  private async computeDiff(
    local: LocalFile[],
    remote: R2Object[]
  ): Promise<SyncDiff> {
    const toUpload: LocalFile[] = [];
    const toDelete: R2Object[] = [];

    // Find new/modified files
    for (const file of local) {
      const remote = remote.find(r => r.key === file.path);
      if (!remote || remote.contentHash !== file.hash) {
        toUpload.push(file);
      }
    }

    // Find deleted files
    if (options.allowDelete) {
      for (const obj of remote) {
        if (!local.find(f => f.path === obj.key)) {
          toDelete.push(obj);
        }
      }
    }

    return { toUpload, toDelete };
  }
}
```

---

## Package Configuration

```json
{
  "name": "@portfolio/r2-sync",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "r2-sync": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "sync": "node ./dist/cli.js"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "wrangler": "^3.0.0",
    "chalk": "^5.0.0"
  }
}
```

---

## Related Documents

- [High-Level Design](../01-high-level-design.md)
- [Implementation Plan](../02-implementation-plan.md)
