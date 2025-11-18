# Phase 4 Execution Plan: Document Processor with Durable Objects

**Version**: 1.0
**Created**: 2025-11-12
**Status**: Ready to Execute
**Estimated Duration**: 3 weeks

---

## Overview

Phase 4 implements the event-driven document ingestion pipeline using Cloudflare Durable Objects. This is the most complex phase of the migration, building an automated system that processes documents from R2, generates embeddings and tags via OpenAI, and stores results in D1 and Vectorize.

### Goals

1. Build a production-ready document processing pipeline using Durable Objects
2. Implement state machine-based processing to stay within Worker runtime limits
3. Process documents of any size through batched operations
4. Ensure strong consistency and automatic error recovery
5. Create self-healing reconciliation system
6. Achieve <5 minute processing latency per document

### Prerequisites

✅ Phase 1 complete (infrastructure created)
✅ Phase 2 complete (R2 sync operational)
✅ Phase 3 complete (shared package available)
✅ OpenAI API key with access to embeddings and chat models
✅ Understanding of Durable Objects programming model

### Architecture Notes

**Why Durable Objects?**

Processing medium/large documents in a single Worker invocation will exceed:
- **30-second CPU time limit** for queue consumers
- **50 subrequest limit** per invocation (each OpenAI call counts)
- **128MB memory limit** for large documents

**Solution**: Use Durable Objects to orchestrate a state machine where each step executes in a separate Worker invocation, staying well within limits.

**Processing Flow**:
```
R2 Event → Queue → Worker → Durable Object
                              ↓
                    State Machine:
                    1. Download & Chunk (< 5s, 1 subrequest)
                    2. Generate Embeddings (batched, 10 chunks/batch)
                    3. Generate Tags (batched, 5 chunks/batch)
                    4. Store to D1 + Vectorize (two-phase commit)
```

---

## Task 1: Project Structure Setup

**Goal**: Initialize the document processor Worker with Durable Object support

### Task 1.1: Create Package Directory

```bash
# From repo root
mkdir -p apps/document-processor/src
cd apps/document-processor
```

**Verification**:
```bash
ls -la
# Should show: src/
```

### Task 1.2: Initialize Package Configuration

**File**: `apps/document-processor/package.json`

```json
{
  "name": "@portfolio/document-processor",
  "version": "1.0.0",
  "description": "Event-driven document processing with Durable Objects",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "lint": "biome check ."
  },
  "dependencies": {
    "@portfolio/shared": "workspace:*",
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241127.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0",
    "wrangler": "^3.97.0"
  }
}
```

**Key Dependencies**:
- `@portfolio/shared` - Our shared utilities from Phase 3
- `openai` - OpenAI API client
- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers

### Task 1.3: TypeScript Configuration

**File**: `apps/document-processor/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types", "node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Task 1.4: Wrangler Configuration

**File**: `apps/document-processor/wrangler.jsonc`

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/cloudflare/wrangler/main/wrangler-schema.json",
  "name": "document-processor",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],

  // Default environment is staging (deployed from main branch)
  // Single R2 bucket shared across all environments
  "r2_buckets": [
    {
      "binding": "DOCUMENTS_BUCKET",
      "bucket_name": "portfolio-documents"
    }
  ],

  // Staging D1 database
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "portfolio-staging",
      "database_id": "YOUR_STAGING_DATABASE_ID"
    }
  ],

  // Staging Vectorize index
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "portfolio-embeddings-staging"
    }
  ],

  // Durable Objects binding (same for all environments)
  "durable_objects": {
    "bindings": [
      {
        "name": "DOCUMENT_PROCESSOR",
        "class_name": "DocumentProcessor",
        "script_name": "document-processor"
      }
    ]
  },

  // Staging Queue
  "queues": {
    "consumers": [
      {
        "queue": "document-processing-staging",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "document-processing-dlq-staging"
      }
    ],
    "producers": [
      {
        "binding": "PROCESSING_QUEUE",
        "queue": "document-processing-staging"
      }
    ]
  },

  // Environment variables (use .dev.vars for local)
  "vars": {
    "ENVIRONMENT": "staging"
  },

  // Production environment (deployed from prod branch)
  "env": {
    "production": {
      "vars": {
        "ENVIRONMENT": "production"
      },
      // Same R2 bucket (shared)
      "r2_buckets": [
        {
          "binding": "DOCUMENTS_BUCKET",
          "bucket_name": "portfolio-documents"
        }
      ],
      // Production D1 database
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "portfolio-prod",
          "database_id": "YOUR_PROD_DATABASE_ID"
        }
      ],
      // Production Vectorize index
      "vectorize": [
        {
          "binding": "VECTORIZE",
          "index_name": "portfolio-embeddings-prod"
        }
      ],
      // Production Queue
      "queues": {
        "consumers": [
          {
            "queue": "document-processing-prod"
          }
        ],
        "producers": [
          {
            "binding": "PROCESSING_QUEUE",
            "queue": "document-processing-prod"
          }
        ]
      }
    }
  }
}
```

**Architecture Notes**:
- **Single R2 bucket** (`portfolio-documents`) shared across environments
- **Two D1 databases**: `portfolio-staging` and `portfolio-prod`
- **Two Vectorize indexes**: `portfolio-embeddings-staging` and `portfolio-embeddings-prod`
- **Two Queues**: `document-processing-staging` and `document-processing-prod`
- **Default environment is staging** (main branch → staging)
- **Production environment** is explicitly configured (prod branch → production)

### Task 1.5: Install Dependencies

```bash
cd apps/document-processor
pnpm install
```

**Verification**:
```bash
ls node_modules | grep -E "(openai|@portfolio)"
# Should show openai and @portfolio/shared
```

### Task 1.6: Create Environment Variables File

**File**: `apps/document-processor/.dev.vars`

```bash
# OpenAI API key
OPENAI_API_KEY=sk-...your-key-here...

# Cloudflare Account ID (for local development)
CLOUDFLARE_ACCOUNT_ID=70e742defbfbc3bbf6228e06626c7766
```

**Note**: Add `.dev.vars` to `.gitignore` if not already there.

---

## Task 2: Define Type Interfaces

**Goal**: Create type-safe interfaces for Cloudflare bindings and processing state

### Task 2.1: Generate Cloudflare Types with cf-typegen

Wrangler can automatically generate TypeScript types for your bindings using `wrangler types`.

**Step 1**: Add types script to package.json:

**File**: `apps/document-processor/package.json` (update scripts section)

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "types": "wrangler types",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "lint": "biome check ."
  }
}
```

**Step 2**: Generate types:

```bash
cd apps/document-processor
pnpm types
```

This creates `worker-configuration.d.ts` with auto-generated types for all bindings from `wrangler.jsonc`.

**Step 3**: Update tsconfig.json to include generated types:

**File**: `apps/document-processor/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types", "node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*", "worker-configuration.d.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Verification**:
```bash
# Generated types should include all bindings
cat worker-configuration.d.ts
```

**Expected output** (example):
```typescript
// Generated by Wrangler
interface Env {
  DOCUMENTS_BUCKET: R2Bucket;
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  DOCUMENT_PROCESSOR: DurableObjectNamespace;
  PROCESSING_QUEUE: Queue;
  OPENAI_API_KEY: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  ENVIRONMENT: string;
}
```

### Task 2.2: Create Custom Types File

Create additional types for business logic (not auto-generated):

**File**: `apps/document-processor/src/types.ts`

```typescript
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
 * Document metadata extracted from R2 object or metadata file
 */
export interface DocumentMetadata {
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
  metadata?: DocumentMetadata;
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
```

**Verification**:
```bash
pnpm exec tsc --noEmit
# Should compile without errors
```

---

## Task 3: Implement Durable Object State Machine

**Goal**: Create the core Durable Object class that orchestrates document processing

### Task 3.1: Create Durable Object Class

**File**: `apps/document-processor/src/document-processor.ts`

```typescript
import type { DurableObject, DurableObjectState } from '@cloudflare/workers-types';
import type { Env, ProcessingState, ProcessingChunk, ProcessingStatus } from './types';
import {
  chunkMarkdown,
  generateEmbeddingsBatch,
  generateTagsBatch,
  EMBEDDING_BATCH_SIZE,
  TAG_BATCH_SIZE,
} from '@portfolio/shared';

/**
 * DocumentProcessor Durable Object
 *
 * Orchestrates document processing through a state machine:
 * 1. Download from R2 and chunk
 * 2. Generate embeddings (batched)
 * 3. Generate tags (batched)
 * 4. Store to D1 and Vectorize
 *
 * Each step executes in a separate Worker invocation to stay within limits.
 */
export class DocumentProcessor implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/start':
          return await this.handleStart(request);
        case '/status':
          return await this.handleStatus();
        case '/retry':
          return await this.handleRetry();
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Start processing a document
   */
  private async handleStart(request: Request): Promise<Response> {
    const { r2Key } = await request.json<{ r2Key: string }>();

    // Check if already processing
    const existingState = await this.state.storage.get<ProcessingState>('state');
    if (existingState?.status === 'processing') {
      return new Response(
        JSON.stringify({
          status: 'already_processing',
          message: 'Document is already being processed',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize state
    const initialState: ProcessingState = {
      status: 'processing',
      r2Key,
      startedAt: new Date().toISOString(),
      currentStep: 'download',
      chunks: [],
      totalChunks: 0,
      processedChunks: 0,
      embeddingBatchIndex: 0,
      tagsBatchIndex: 0,
      errors: [],
      retryCount: 0,
    };

    await this.state.storage.put('state', initialState);

    // Schedule first step immediately
    await this.state.storage.setAlarm(Date.now() + 100);

    return new Response(
      JSON.stringify({
        status: 'processing',
        message: 'Processing started',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get processing status
   */
  private async handleStatus(): Promise<Response> {
    const state = await this.state.storage.get<ProcessingState>('state');

    if (!state) {
      return new Response(
        JSON.stringify({
          status: 'not_started',
          currentStep: 'download',
          progress: { totalChunks: 0, processedChunks: 0, percentage: 0 },
          errors: [],
          timing: {},
        } as ProcessingStatus),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const status: ProcessingStatus = {
      status: state.status,
      currentStep: state.currentStep,
      progress: {
        totalChunks: state.totalChunks,
        processedChunks: state.processedChunks,
        percentage:
          state.totalChunks > 0
            ? Math.round((state.processedChunks / state.totalChunks) * 100)
            : 0,
      },
      errors: state.errors,
      timing: {
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        failedAt: state.failedAt,
        duration:
          state.completedAt || state.failedAt
            ? new Date(state.completedAt || state.failedAt!).getTime() -
              new Date(state.startedAt!).getTime()
            : undefined,
      },
      documentId: state.documentId,
    };

    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Retry failed processing
   */
  private async handleRetry(): Promise<Response> {
    const state = await this.state.storage.get<ProcessingState>('state');

    if (!state || state.status !== 'failed') {
      return new Response(
        JSON.stringify({
          error: 'Cannot retry: document is not in failed state',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Reset state for retry
    await this.state.storage.put('state', {
      ...state,
      status: 'processing',
      currentStep: 'download',
      retryCount: 0,
      errors: [],
      failedAt: undefined,
    });

    // Schedule restart
    await this.state.storage.setAlarm(Date.now() + 100);

    return new Response(
      JSON.stringify({
        status: 'processing',
        message: 'Processing restarted',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler - executes next step in state machine
   */
  async alarm(): Promise<void> {
    const state = await this.state.storage.get<ProcessingState>('state');

    if (!state || state.status !== 'processing') {
      return;
    }

    try {
      switch (state.currentStep) {
        case 'download':
          await this.downloadAndChunk();
          break;
        case 'embeddings':
          await this.generateEmbeddingsBatch();
          break;
        case 'tags':
          await this.generateTagsBatch();
          break;
        case 'store':
          await this.storeToD1AndVectorize();
          break;
      }
    } catch (error) {
      await this.handleError(state.currentStep, error);
    }
  }

  /**
   * Step 1: Download from R2 and chunk
   */
  private async downloadAndChunk(): Promise<void> {
    const state = await this.state.storage.get<ProcessingState>('state');
    if (!state) throw new Error('State not found');

    console.log(`[${state.r2Key}] Step 1: Downloading and chunking`);

    // Download from R2
    const object = await this.env.DOCUMENTS_BUCKET.get(state.r2Key);
    if (!object) {
      throw new Error(`Object ${state.r2Key} not found in R2`);
    }

    const content = await object.text();

    // Extract metadata
    const metadata = await this.extractMetadata(state.r2Key, object);

    // Chunk document using shared utility
    const markdownChunks = chunkMarkdown(content);

    // Convert to ProcessingChunks
    const chunks: ProcessingChunk[] = markdownChunks.map((chunk) => ({
      index: chunk.index,
      text: chunk.content,
      tokens: chunk.tokens,
      embedding: null,
      tags: null,
      status: 'pending',
    }));

    console.log(`[${state.r2Key}] Created ${chunks.length} chunks`);

    // Update state
    await this.state.storage.put('state', {
      ...state,
      metadata,
      content,
      chunks,
      totalChunks: chunks.length,
      currentStep: 'embeddings',
      embeddingBatchIndex: 0,
    });

    // Schedule next step
    await this.state.storage.setAlarm(Date.now() + 100);
  }

  /**
   * Step 2: Generate embeddings (batched)
   */
  private async generateEmbeddingsBatch(): Promise<void> {
    const state = await this.state.storage.get<ProcessingState>('state');
    if (!state) throw new Error('State not found');

    const batchSize = EMBEDDING_BATCH_SIZE;
    const startIndex = state.embeddingBatchIndex;
    const batch = state.chunks.slice(startIndex, startIndex + batchSize);

    // Check if all embeddings are done
    if (batch.length === 0) {
      console.log(`[${state.r2Key}] All embeddings generated`);

      await this.state.storage.put('state', {
        ...state,
        currentStep: 'tags',
        tagsBatchIndex: 0,
      });

      await this.state.storage.setAlarm(Date.now() + 100);
      return;
    }

    console.log(
      `[${state.r2Key}] Generating embeddings for chunks ${startIndex} to ${startIndex + batch.length - 1}`
    );

    // Generate embeddings using shared utility
    const texts = batch.map((c) => c.text);
    const embeddings = await generateEmbeddingsBatch(texts, {
      apiKey: this.env.OPENAI_API_KEY,
    });

    // Update chunks with embeddings
    batch.forEach((chunk, i) => {
      const chunkIndex = startIndex + i;
      state.chunks[chunkIndex].embedding = embeddings[i];
      state.chunks[chunkIndex].status = 'embedding_done';
    });

    // Update state
    await this.state.storage.put('state', {
      ...state,
      chunks: state.chunks,
      embeddingBatchIndex: startIndex + batch.length,
      processedChunks: startIndex + batch.length,
    });

    // Schedule next batch
    await this.state.storage.setAlarm(Date.now() + 100);
  }

  /**
   * Step 3: Generate tags (batched)
   */
  private async generateTagsBatch(): Promise<void> {
    const state = await this.state.storage.get<ProcessingState>('state');
    if (!state) throw new Error('State not found');

    const batchSize = TAG_BATCH_SIZE;
    const startIndex = state.tagsBatchIndex;
    const batch = state.chunks.slice(startIndex, startIndex + batchSize);

    // Check if all chunk tags are done
    if (batch.length === 0) {
      // Generate document-level tags
      if (!state.documentTags && state.content) {
        console.log(`[${state.r2Key}] Generating document-level tags`);

        const documentTags = await generateTagsBatch([state.content], {
          apiKey: this.env.OPENAI_API_KEY,
        });

        await this.state.storage.put('state', {
          ...state,
          documentTags: documentTags[0],
          currentStep: 'store',
        });
      } else {
        await this.state.storage.put('state', {
          ...state,
          currentStep: 'store',
        });
      }

      await this.state.storage.setAlarm(Date.now() + 100);
      return;
    }

    console.log(
      `[${state.r2Key}] Generating tags for chunks ${startIndex} to ${startIndex + batch.length - 1}`
    );

    // Generate tags using shared utility
    const texts = batch.map((c) => c.text);
    const tags = await generateTagsBatch(texts, {
      apiKey: this.env.OPENAI_API_KEY,
    });

    // Update chunks with tags
    batch.forEach((chunk, i) => {
      const chunkIndex = startIndex + i;
      state.chunks[chunkIndex].tags = tags[i];
      state.chunks[chunkIndex].status = 'tags_done';
    });

    // Update state
    await this.state.storage.put('state', {
      ...state,
      chunks: state.chunks,
      tagsBatchIndex: startIndex + batch.length,
    });

    // Schedule next batch
    await this.state.storage.setAlarm(Date.now() + 100);
  }

  /**
   * Step 4: Store to D1 and Vectorize (two-phase commit)
   */
  private async storeToD1AndVectorize(): Promise<void> {
    const state = await this.state.storage.get<ProcessingState>('state');
    if (!state || !state.metadata) {
      throw new Error('State or metadata not found');
    }

    console.log(`[${state.r2Key}] Storing to D1 and Vectorize`);

    const jobId = crypto.randomUUID();

    // Look up company ID
    const companyResult = await this.env.DB.prepare(
      `SELECT id FROM companies WHERE name = ?`
    )
      .bind(state.metadata.company)
      .first<{ id: number }>();

    if (!companyResult) {
      throw new Error(`Company not found: ${state.metadata.company}`);
    }

    const companyId = companyResult.id;

    // Phase 1: Insert document into D1
    const docResult = await this.env.DB.prepare(
      `INSERT INTO documents (content_hash, company_id, project, tags, r2_key)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`
    )
      .bind(
        state.metadata.contentHash,
        companyId,
        state.metadata.project,
        JSON.stringify(state.documentTags || []),
        state.r2Key
      )
      .first<{ id: number }>();

    if (!docResult) {
      throw new Error('Failed to insert document');
    }

    const documentId = docResult.id;

    console.log(`[${state.r2Key}] Created document ID: ${documentId}`);

    // Phase 2: Store chunks (Vectorize first, then D1)
    // Two-phase commit: Vectorize upsert is idempotent, so we do it first
    for (const chunk of state.chunks) {
      const vectorizeId = `${jobId}-${chunk.index}`;

      if (!chunk.embedding) {
        throw new Error(`Chunk ${chunk.index} missing embedding`);
      }

      // Store in Vectorize first (idempotent)
      await this.env.VECTORIZE.upsert([
        {
          id: vectorizeId,
          values: chunk.embedding,
          metadata: {
            document_id: documentId,
            chunk_index: chunk.index,
            tags: chunk.tags || [],
          },
        },
      ]);

      // Then store in D1
      await this.env.DB.prepare(
        `INSERT INTO chunks (content, document_id, type, tags, vectorize_id)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(
          chunk.text,
          documentId,
          'markdown',
          JSON.stringify(chunk.tags || []),
          vectorizeId
        )
        .run();
    }

    console.log(`[${state.r2Key}] Stored ${state.chunks.length} chunks`);

    // Mark as complete
    await this.state.storage.put('state', {
      ...state,
      status: 'completed',
      currentStep: 'complete',
      documentId,
      completedAt: new Date().toISOString(),
    });

    console.log(`[${state.r2Key}] Processing complete`);
  }

  /**
   * Extract metadata from R2 object
   */
  private async extractMetadata(
    r2Key: string,
    object: R2ObjectBody
  ): Promise<DocumentMetadata> {
    // Try to get metadata from custom metadata
    const customMetadata = object.customMetadata;

    if (customMetadata?.project && customMetadata?.company) {
      return {
        project: customMetadata.project,
        company: customMetadata.company,
        r2Key,
        contentHash: object.checksums?.sha256 || object.etag,
      };
    }

    // Try to find companion JSON file
    const jsonKey = r2Key.replace(/\.md$/, '.json');
    const jsonObject = await this.env.DOCUMENTS_BUCKET.get(jsonKey);

    if (jsonObject) {
      const jsonContent = await jsonObject.text();
      const metadata = JSON.parse(jsonContent);

      return {
        project: metadata.project,
        company: metadata.company,
        r2Key,
        contentHash: object.checksums?.sha256 || object.etag,
      };
    }

    // Fallback: extract from filename
    throw new Error(`No metadata found for ${r2Key}`);
  }

  /**
   * Handle errors with retry logic
   */
  private async handleError(step: string, error: unknown): Promise<void> {
    const state = await this.state.storage.get<ProcessingState>('state');
    if (!state) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${state.r2Key}] Error in step ${step}:`, errorMessage);

    const errors = [
      ...state.errors,
      {
        step,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        retryable: true,
      },
    ];

    const retryCount = state.retryCount + 1;

    if (retryCount < 3) {
      // Retry with exponential backoff
      const delayMs = Math.pow(2, retryCount) * 1000;

      console.log(`[${state.r2Key}] Retrying in ${delayMs}ms (attempt ${retryCount + 1}/3)`);

      await this.state.storage.put('state', {
        ...state,
        errors,
        retryCount,
      });

      await this.state.storage.setAlarm(Date.now() + delayMs);
    } else {
      // Max retries exceeded
      console.error(`[${state.r2Key}] Max retries exceeded, marking as failed`);

      await this.state.storage.put('state', {
        ...state,
        status: 'failed',
        errors,
        failedAt: new Date().toISOString(),
      });
    }
  }
}
```

**Verification**:
```bash
pnpm exec tsc --noEmit
# Should compile without errors
```

---

## Task 4: Implement Worker Entry Point

**Goal**: Create main Worker that handles queue messages and HTTP requests

### Task 4.1: Create Worker Index

**File**: `apps/document-processor/src/index.ts`

```typescript
import type { Env, ProcessingMessage } from './types';
import { DocumentProcessor } from './document-processor';

/**
 * Main Worker entry point
 *
 * Handles:
 * - Queue messages from R2 event notifications
 * - HTTP endpoints for manual triggers and status queries
 */
export default {
  /**
   * Handle queue messages from R2 event notifications
   */
  async queue(batch: MessageBatch<ProcessingMessage>, env: Env, ctx: ExecutionContext) {
    console.log(`Processing batch of ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        const { r2Key, event } = message.body;

        console.log(`Processing ${event || 'upload'} event for ${r2Key}`);

        // Ignore delete events
        if (event === 'delete') {
          message.ack();
          continue;
        }

        // Get or create Durable Object for this document
        const processorId = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const processor = env.DOCUMENT_PROCESSOR.get(processorId);

        // Start processing
        const response = await processor.fetch(
          new Request('http://do/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ r2Key }),
          })
        );

        const result = await response.json();

        if (response.ok) {
          console.log(`Started processing for ${r2Key}:`, result);
          message.ack();
        } else {
          console.error(`Failed to start processing for ${r2Key}:`, result);
          message.retry({
            delaySeconds: Math.pow(2, message.attempts) * 10,
          });
        }
      } catch (error) {
        console.error('Error processing message:', error);
        message.retry({
          delaySeconds: Math.pow(2, message.attempts) * 10,
        });
      }
    }
  },

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Manual trigger endpoint
      if (url.pathname === '/process' && request.method === 'POST') {
        const { r2Key } = await request.json<{ r2Key: string }>();

        // Queue the document for processing
        await env.PROCESSING_QUEUE.send({ r2Key, event: 'upload' });

        return new Response(
          JSON.stringify({
            status: 'queued',
            message: `Document ${r2Key} queued for processing`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Status query endpoint
      if (url.pathname.startsWith('/status/')) {
        const r2Key = decodeURIComponent(url.pathname.substring(8));

        const processorId = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const processor = env.DOCUMENT_PROCESSOR.get(processorId);

        const response = await processor.fetch(new Request('http://do/status'));
        const status = await response.json();

        return new Response(JSON.stringify(status), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Retry endpoint
      if (url.pathname.startsWith('/retry/') && request.method === 'POST') {
        const r2Key = decodeURIComponent(url.pathname.substring(7));

        const processorId = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const processor = env.DOCUMENT_PROCESSOR.get(processorId);

        const response = await processor.fetch(
          new Request('http://do/retry', { method: 'POST' })
        );

        const result = await response.json();

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Health check
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({
            ok: true,
            version: '1.0.0',
            environment: env.ENVIRONMENT,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not found', {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

// Export Durable Object class
export { DocumentProcessor };
```

**Verification**:
```bash
pnpm exec tsc --noEmit
# Should compile without errors
```

---

## Task 5: Local Development and Testing

**Goal**: Set up local development environment and test the processor

### Task 5.1: Configure Local Development

Update `.dev.vars` with all required credentials:

```bash
# OpenAI API key
OPENAI_API_KEY=sk-...

# Cloudflare Account ID
CLOUDFLARE_ACCOUNT_ID=70e742defbfbc3bbf6228e06626c7766
```

### Task 5.2: Start Local Development Server

```bash
cd apps/document-processor
pnpm dev
```

This starts Wrangler in development mode with:
- Local D1 database
- Local Vectorize index (simulated)
- Local R2 bucket (simulated)
- Durable Objects enabled

### Task 5.3: Test Manual Processing

```bash
# In another terminal, trigger processing
curl -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "experiments/test.md"}'

# Check status
curl http://localhost:8787/status/experiments%2Ftest.md
```

**Expected Response**:
```json
{
  "status": "processing",
  "currentStep": "embeddings",
  "progress": {
    "totalChunks": 10,
    "processedChunks": 5,
    "percentage": 50
  },
  "errors": [],
  "timing": {
    "startedAt": "2025-11-12T10:00:00Z"
  }
}
```

### Task 5.4: Create Test Script

**File**: `apps/document-processor/test-local.sh`

```bash
#!/bin/bash
# Test document processor locally

set -e

echo "Testing Document Processor"
echo "=========================="
echo ""

# 1. Check health
echo "1. Health check..."
curl -s http://localhost:8787/health | jq
echo ""

# 2. Trigger processing
echo "2. Triggering processing..."
TRIGGER_RESULT=$(curl -s -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "experiments/test.md"}')
echo $TRIGGER_RESULT | jq
echo ""

# 3. Wait a bit
echo "3. Waiting 5 seconds..."
sleep 5
echo ""

# 4. Check status
echo "4. Checking status..."
curl -s http://localhost:8787/status/experiments%2Ftest.md | jq
echo ""

echo "Test complete!"
```

Make executable:
```bash
chmod +x apps/document-processor/test-local.sh
```

Run test:
```bash
./apps/document-processor/test-local.sh
```

---

## Task 6: Unit Testing

**Goal**: Create comprehensive unit tests for the processor

### Task 6.1: Create Test Utilities

**File**: `apps/document-processor/src/test-utils.ts`

```typescript
import type { Env, ProcessingState } from './types';

/**
 * Create mock Env for testing
 */
export function createMockEnv(): Env {
  return {
    DOCUMENTS_BUCKET: createMockR2Bucket(),
    DB: createMockD1Database(),
    VECTORIZE: createMockVectorize(),
    DOCUMENT_PROCESSOR: {} as any, // Not used in unit tests
    PROCESSING_QUEUE: createMockQueue(),
    OPENAI_API_KEY: 'test-api-key',
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    ENVIRONMENT: 'dev',
  };
}

function createMockR2Bucket() {
  const storage = new Map<string, string>();

  return {
    get: async (key: string) => {
      const content = storage.get(key);
      if (!content) return null;

      return {
        text: async () => content,
        customMetadata: {
          project: 'Test Project',
          company: 'Test Company',
        },
        checksums: {
          sha256: 'test-hash',
        },
        etag: 'test-etag',
      };
    },
    put: async (key: string, value: string) => {
      storage.set(key, value);
    },
  } as any;
}

function createMockD1Database() {
  return {
    prepare: (sql: string) => ({
      bind: (...args: any[]) => ({
        first: async () => ({ id: 1 }),
        run: async () => ({}),
      }),
    }),
  } as any;
}

function createMockVectorize() {
  return {
    upsert: async (vectors: any[]) => ({}),
  } as any;
}

function createMockQueue() {
  return {
    send: async (message: any) => ({}),
  } as any;
}
```

### Task 6.2: Create Processing Tests

**File**: `apps/document-processor/src/document-processor.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentProcessor } from './document-processor';
import { createMockEnv } from './test-utils';
import type { DurableObjectState } from '@cloudflare/workers-types';

// Mock the shared package
vi.mock('@portfolio/shared', () => ({
  chunkMarkdown: vi.fn((content: string) => [
    { index: 0, content: 'Chunk 1', tokens: 100 },
    { index: 1, content: 'Chunk 2', tokens: 100 },
  ]),
  generateEmbeddingsBatch: vi.fn((texts: string[]) =>
    texts.map(() => new Array(1536).fill(0.1))
  ),
  generateTagsBatch: vi.fn((texts: string[]) =>
    texts.map(() => ['test', 'tag'])
  ),
  EMBEDDING_BATCH_SIZE: 10,
  TAG_BATCH_SIZE: 5,
}));

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  let mockState: DurableObjectState;
  let mockEnv: any;

  beforeEach(() => {
    const storage = new Map();

    mockState = {
      storage: {
        get: vi.fn(async (key: string) => storage.get(key)),
        put: vi.fn(async (key: string, value: any) => {
          storage.set(key, value);
        }),
        setAlarm: vi.fn(async (time: number) => {}),
      },
    } as any;

    mockEnv = createMockEnv();

    processor = new DocumentProcessor(mockState, mockEnv);
  });

  describe('handleStart', () => {
    it('should initialize processing state', async () => {
      const request = new Request('http://do/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: 'test.md' }),
      });

      const response = await processor.fetch(request);
      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.status).toBe('processing');
      expect(mockState.storage.put).toHaveBeenCalled();
      expect(mockState.storage.setAlarm).toHaveBeenCalled();
    });

    it('should reject if already processing', async () => {
      // Set up existing state
      await mockState.storage.put('state', {
        status: 'processing',
        r2Key: 'test.md',
      });

      const request = new Request('http://do/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: 'test.md' }),
      });

      const response = await processor.fetch(request);
      const result = await response.json();

      expect(result.status).toBe('already_processing');
    });
  });

  describe('handleStatus', () => {
    it('should return not_started for new document', async () => {
      const request = new Request('http://do/status');
      const response = await processor.fetch(request);
      const result = await response.json();

      expect(result.status).toBe('not_started');
      expect(result.progress.totalChunks).toBe(0);
    });

    it('should return current processing status', async () => {
      await mockState.storage.put('state', {
        status: 'processing',
        currentStep: 'embeddings',
        totalChunks: 10,
        processedChunks: 5,
        errors: [],
        startedAt: new Date().toISOString(),
      });

      const request = new Request('http://do/status');
      const response = await processor.fetch(request);
      const result = await response.json();

      expect(result.status).toBe('processing');
      expect(result.currentStep).toBe('embeddings');
      expect(result.progress.percentage).toBe(50);
    });
  });
});
```

Run tests:
```bash
pnpm test
```

---

## Task 7: R2 Reconciliation Worker

**Goal**: Create self-healing reconciliation system

### Task 7.1: Create Reconciliation Worker

**File**: `apps/r2-reconciliation/wrangler.jsonc`

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/cloudflare/wrangler/main/wrangler-schema.json",
  "name": "r2-reconciliation",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",

  // Daily cron job at 2 AM UTC
  "triggers": {
    "crons": ["0 2 * * *"]
  },

  "r2_buckets": [
    {
      "binding": "DOCUMENTS_BUCKET",
      "bucket_name": "portfolio-documents-dev"
    }
  ],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "portfolio-db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ],

  "durable_objects": {
    "bindings": [
      {
        "name": "DOCUMENT_PROCESSOR",
        "class_name": "DocumentProcessor",
        "script_name": "document-processor"
      }
    ]
  },

  "queues": {
    "producers": [
      {
        "binding": "PROCESSING_QUEUE",
        "queue": "document-processing-dev"
      }
    ]
  }
}
```

**File**: `apps/r2-reconciliation/src/index.ts`

```typescript
import type { Env } from './types';

export default {
  /**
   * Scheduled cron job - runs daily
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Starting R2 reconciliation...');
    await reconcileR2Documents(env);
  },

  /**
   * Manual trigger endpoint
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/reconcile' && request.method === 'POST') {
      ctx.waitUntil(reconcileR2Documents(env));

      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'Reconciliation started',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ ok: true, version: '1.0.0' }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Not found', { status: 404 });
  },
};

/**
 * Reconcile R2 documents with D1 database
 */
async function reconcileR2Documents(env: Env): Promise<void> {
  const BATCH_SIZE = 100;
  let cursor: string | undefined;
  let totalChecked = 0;
  let totalQueued = 0;
  let totalStuck = 0;

  do {
    // List objects in R2 bucket
    const listed = await env.DOCUMENTS_BUCKET.list({
      limit: BATCH_SIZE,
      cursor,
      include: ['customMetadata'],
    });

    for (const object of listed.objects) {
      // Only process markdown files
      if (!object.key.endsWith('.md')) {
        continue;
      }

      totalChecked++;

      // Check if document exists in D1
      const existing = await env.DB.prepare(
        `SELECT id FROM documents WHERE r2_key = ?`
      )
        .bind(object.key)
        .first();

      if (!existing) {
        // Document not in D1, check Durable Object status
        const processorId = env.DOCUMENT_PROCESSOR.idFromName(object.key);
        const processor = env.DOCUMENT_PROCESSOR.get(processorId);

        try {
          const statusResponse = await processor.fetch(
            new Request('http://do/status')
          );
          const status = await statusResponse.json();

          if (status.status === 'not_started' || status.status === 'failed') {
            // Queue for processing
            console.log(`Queuing unprocessed document: ${object.key}`);
            await env.PROCESSING_QUEUE.send({
              r2Key: object.key,
              event: 'upload',
            });
            totalQueued++;
          } else if (status.status === 'processing') {
            // Check if stuck (>24 hours)
            const startedAt = new Date(status.timing.startedAt);
            const hours = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);

            if (hours > 24) {
              console.log(`Retrying stuck document: ${object.key}`);
              await processor.fetch(
                new Request('http://do/retry', { method: 'POST' })
              );
              totalStuck++;
            }
          }
        } catch (error) {
          console.error(`Error checking status for ${object.key}:`, error);
        }
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  console.log(
    `Reconciliation complete: checked ${totalChecked}, queued ${totalQueued}, retried ${totalStuck}`
  );
}
```

**File**: `apps/r2-reconciliation/src/types.ts`

```typescript
import type {
  DurableObjectNamespace,
  R2Bucket,
  D1Database,
  Queue,
} from '@cloudflare/workers-types';

export interface Env {
  DOCUMENTS_BUCKET: R2Bucket;
  DB: D1Database;
  DOCUMENT_PROCESSOR: DurableObjectNamespace;
  PROCESSING_QUEUE: Queue;
}
```

### Task 7.2: Deploy Reconciliation Worker

```bash
cd apps/r2-reconciliation
pnpm install
wrangler deploy
```

### Task 7.3: Test Reconciliation Manually

```bash
# Trigger reconciliation manually
curl -X POST https://r2-reconciliation.your-subdomain.workers.dev/reconcile

# Check logs
wrangler tail r2-reconciliation
```

---

## Task 8: Deployment and Configuration

**Goal**: Deploy document processor to production

### Task 8.1: Update Wrangler Configuration with Real IDs

Get resource IDs from Phase 1:

```bash
# Get D1 database ID
wrangler d1 list

# Get Vectorize index name
wrangler vectorize list

# Get Queue name
wrangler queues list
```

Update `wrangler.jsonc` with actual IDs.

### Task 8.2: Set Production Secrets

```bash
# Set OpenAI API key
wrangler secret put OPENAI_API_KEY --env production

# Set Cloudflare Account ID (if needed)
wrangler secret put CLOUDFLARE_ACCOUNT_ID --env production
```

### Task 8.3: Deploy to Dev Environment

```bash
wrangler deploy --env dev
```

**Verification**:
```bash
# Test health endpoint
curl https://document-processor.your-subdomain.workers.dev/health

# Trigger test processing
curl -X POST https://document-processor.your-subdomain.workers.dev/process \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "experiments/test.md"}'
```

### Task 8.4: Monitor Processing

```bash
# Tail logs
wrangler tail document-processor --env dev

# Check status
curl https://document-processor.your-subdomain.workers.dev/status/experiments%2Ftest.md
```

### Task 8.5: Deploy to Production

After dev testing succeeds:

```bash
wrangler deploy --env production
```

---

## Task 9: GitHub Actions Deployment Workflow

**Goal**: Automate deployments to staging and production environments

### Task 9.1: Create Deployment Workflow

**File**: `.github/workflows/deploy-document-processor.yml`

```yaml
name: Deploy Document Processor

on:
  push:
    branches:
      - main      # Deploy to staging
      - prod      # Deploy to production
    paths:
      - 'apps/document-processor/**'
      - 'packages/shared/**'
      - '.github/workflows/deploy-document-processor.yml'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to ${{ github.ref == 'refs/heads/prod' && 'production' || 'staging' }}

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

      - name: Build shared package
        run: pnpm --filter @portfolio/shared build

      - name: Generate types
        run: pnpm --filter @portfolio/document-processor types
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy to staging (main branch)
        if: github.ref == 'refs/heads/main'
        run: pnpm --filter @portfolio/document-processor deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy to production (prod branch)
        if: github.ref == 'refs/heads/prod'
        run: pnpm --filter @portfolio/document-processor deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy to manual environment
        if: github.event_name == 'workflow_dispatch'
        run: |
          if [ "${{ github.event.inputs.environment }}" == "production" ]; then
            pnpm --filter @portfolio/document-processor deploy --env production
          else
            pnpm --filter @portfolio/document-processor deploy
          fi
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Branch Strategy**:
- `main` branch → deploys to **staging** environment (default)
- `prod` branch → deploys to **production** environment
- Manual workflow dispatch → choose environment

### Task 9.2: Set GitHub Secrets

Go to repository settings → Secrets and variables → Actions:

1. **CLOUDFLARE_API_TOKEN** - API token with Workers permissions
2. **CLOUDFLARE_ACCOUNT_ID** - Your Cloudflare account ID

These should already exist from Phase 1/2.

### Task 9.3: Test Deployment Workflow

```bash
# Create a test change
echo "// Test change" >> apps/document-processor/src/index.ts

# Commit and push to main (deploys to staging)
git checkout main
git add apps/document-processor/src/index.ts
git commit -m "test: trigger staging deployment"
git push origin main

# Check GitHub Actions tab for deployment status

# For production deployment, merge to prod branch
git checkout prod
git merge main
git push origin prod
```

### Task 9.4: Update Package Scripts for Deployment

**File**: `apps/document-processor/package.json`

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy",
    "deploy:prod": "wrangler deploy --env production",
    "tail": "wrangler tail",
    "tail:prod": "wrangler tail --env production",
    "types": "wrangler types",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "lint": "biome check ."
  }
}
```

**Verification**:
```bash
# Deploy to staging manually
pnpm --filter @portfolio/document-processor deploy:staging

# Deploy to production manually
pnpm --filter @portfolio/document-processor deploy:prod
```

---

## Task 10: Integration Testing

**Goal**: Validate end-to-end processing pipeline

### Task 9.1: Test Small Document

Upload a small test document:

```bash
# Use R2 sync tool from Phase 2
echo "# Test Document\n\nSmall test content." > /tmp/test-small.md

# Upload to R2
wrangler r2 object put portfolio-documents-dev/test/small.md \
  --file /tmp/test-small.md
```

Monitor processing:

```bash
# Watch logs
wrangler tail document-processor --env dev

# Check status every 10 seconds
watch -n 10 'curl -s https://document-processor.your-subdomain.workers.dev/status/test%2Fsmall.md | jq'
```

Verify results in D1:

```bash
wrangler d1 execute portfolio-db --env dev \
  --command "SELECT * FROM documents WHERE r2_key = 'test/small.md'"

wrangler d1 execute portfolio-db --env dev \
  --command "SELECT COUNT(*) FROM chunks WHERE document_id = (SELECT id FROM documents WHERE r2_key = 'test/small.md')"
```

### Task 9.2: Test Medium Document

Upload a real document from your portfolio:

```bash
pnpm sync:r2 --env dev --file experiments/webforms.md
```

Monitor and verify as above.

### Task 9.3: Test Large Document

Create a large test document (>1000 chunks):

```bash
# Generate large markdown file
python3 << 'EOF'
with open('/tmp/test-large.md', 'w') as f:
    f.write('# Large Test Document\n\n')
    for i in range(500):
        f.write(f'## Section {i}\n\n')
        f.write('Lorem ipsum ' * 100 + '\n\n')
EOF

# Upload
wrangler r2 object put portfolio-documents-dev/test/large.md \
  --file /tmp/test-large.md
```

Monitor processing (should take ~5-10 minutes):

```bash
watch -n 30 'curl -s https://document-processor.your-subdomain.workers.dev/status/test%2Flarge.md | jq .progress'
```

### Task 9.4: Test Error Recovery

Test retry logic by temporarily breaking OpenAI API key:

```bash
# Set invalid key
wrangler secret put OPENAI_API_KEY --env dev
# Enter: "invalid-key"

# Trigger processing
curl -X POST https://document-processor.your-subdomain.workers.dev/process \
  -d '{"r2Key": "test/retry.md"}'

# Check status - should show errors and retries
curl https://document-processor.your-subdomain.workers.dev/status/test%2Fretry.md | jq

# Restore valid key
wrangler secret put OPENAI_API_KEY --env dev
# Enter correct key

# Retry manually
curl -X POST https://document-processor.your-subdomain.workers.dev/retry/test%2Fretry.md

# Should succeed now
```

### Task 9.5: Test Reconciliation

```bash
# Delete a document from D1 but leave in R2
wrangler d1 execute portfolio-db --env dev \
  --command "DELETE FROM documents WHERE r2_key = 'test/small.md'"

# Run reconciliation
curl -X POST https://r2-reconciliation.your-subdomain.workers.dev/reconcile

# Wait 30 seconds, check if document was reprocessed
sleep 30
curl https://document-processor.your-subdomain.workers.dev/status/test%2Fsmall.md
```

---

## Task 10: Documentation and Verification

**Goal**: Document usage and verify Phase 4 completion

### Task 10.1: Create README

**File**: `apps/document-processor/README.md`

```markdown
# Document Processor

Event-driven document ingestion pipeline using Cloudflare Durable Objects.

## Features

- Automated processing triggered by R2 events
- State machine-based processing stays within Worker limits
- Batched OpenAI API calls (embeddings and tags)
- Strong consistency with Durable Objects
- Automatic retry with exponential backoff
- Self-healing reconciliation system
- Real-time status tracking

## Architecture

```
R2 Event → Queue → Worker → Durable Object State Machine
                              ↓
                    1. Download & Chunk
                    2. Generate Embeddings (batched)
                    3. Generate Tags (batched)
                    4. Store to D1 + Vectorize
```

## Processing Flow

Each document gets its own Durable Object instance that:
1. Downloads content from R2
2. Chunks markdown into ~800 token segments
3. Generates embeddings in batches of 10 chunks
4. Generates tags in batches of 5 chunks
5. Stores results to D1 and Vectorize

## API Endpoints

### Trigger Processing

```bash
POST /process
Content-Type: application/json

{
  "r2Key": "experiments/webforms.md"
}
```

### Get Status

```bash
GET /status/:r2Key

# Example
GET /status/experiments%2Fwebforms.md
```

Response:
```json
{
  "status": "processing",
  "currentStep": "embeddings",
  "progress": {
    "totalChunks": 50,
    "processedChunks": 25,
    "percentage": 50
  },
  "errors": [],
  "timing": {
    "startedAt": "2025-11-12T10:00:00Z"
  }
}
```

### Retry Failed Job

```bash
POST /retry/:r2Key

# Example
POST /retry/experiments%2Fwebforms.md
```

### Health Check

```bash
GET /health
```

## Development

```bash
# Install dependencies
pnpm install

# Start local dev server
pnpm dev

# Run tests
pnpm test

# Deploy to dev
wrangler deploy --env dev

# Deploy to production
wrangler deploy --env production

# View logs
wrangler tail document-processor
```

## Monitoring

```bash
# Check processing status
curl https://document-processor.your-subdomain.workers.dev/status/path%2Fto%2Fdocument.md

# View real-time logs
wrangler tail document-processor

# Check D1 for processed documents
wrangler d1 execute portfolio-db --command "SELECT COUNT(*) FROM documents"
```

## Reconciliation Worker

Runs daily at 2 AM UTC to discover and process missed documents.

```bash
# Manual trigger
curl -X POST https://r2-reconciliation.your-subdomain.workers.dev/reconcile

# View logs
wrangler tail r2-reconciliation
```

## Troubleshooting

See [Phase 4 Execution Plan](../../docs/cloudflare-migration/execution-plans/phase-4-execution-plan.md#troubleshooting)
```

### Task 10.2: Create Verification Script

**File**: `scripts/verify-phase-4.sh`

```bash
#!/bin/bash
# Phase 4 Verification Script

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 4: Document Processor Verification"
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
check "document-processor exists" "test -d apps/document-processor"
check "package.json exists" "test -f apps/document-processor/package.json"
check "wrangler.jsonc exists" "test -f apps/document-processor/wrangler.jsonc"
check "Source files exist" "test -d apps/document-processor/src"
check "README exists" "test -f apps/document-processor/README.md"
echo ""

# 2. Check source files
echo "2️⃣  Source Files"
check "index.ts exists" "test -f apps/document-processor/src/index.ts"
check "document-processor.ts exists" "test -f apps/document-processor/src/document-processor.ts"
check "types.ts exists" "test -f apps/document-processor/src/types.ts"
echo ""

# 3. Check dependencies
echo "3️⃣  Dependencies"
check "@portfolio/shared installed" "test -d apps/document-processor/node_modules/@portfolio/shared"
check "openai installed" "test -d apps/document-processor/node_modules/openai"
check "wrangler installed" "test -d apps/document-processor/node_modules/wrangler"
echo ""

# 4. Check TypeScript compilation
echo "4️⃣  TypeScript"
check "TypeScript compiles" "cd apps/document-processor && pnpm exec tsc --noEmit"
echo ""

# 5. Check tests
echo "5️⃣  Tests"
check "Tests exist" "test -f apps/document-processor/src/document-processor.test.ts"
check "Tests pass" "cd apps/document-processor && pnpm test run"
echo ""

# 6. Check R2 reconciliation
echo "6️⃣  R2 Reconciliation"
check "Reconciliation worker exists" "test -d apps/r2-reconciliation"
check "Reconciliation index.ts exists" "test -f apps/r2-reconciliation/src/index.ts"
echo ""

# 7. Check deployment readiness
echo "7️⃣  Deployment"
check "Wrangler config valid" "cd apps/document-processor && wrangler deploy --dry-run --outdir /tmp/wrangler-test"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 4 Verification Complete - All checks passed!${NC}"
  echo ""
  echo "🎉 Document Processor ready!"
  echo ""
  echo "Next Steps:"
  echo "  1. Deploy to dev: cd apps/document-processor && wrangler deploy --env dev"
  echo "  2. Test processing: curl -X POST https://document-processor.your-subdomain.workers.dev/process -d '{\"r2Key\":\"test.md\"}'"
  echo "  3. Monitor logs: wrangler tail document-processor"
  echo "  4. Ready for Phase 5: Query Service"
else
  echo -e "${RED}❌ Phase 4 Verification Failed - $ERRORS error(s) found${NC}"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

Make executable:
```bash
chmod +x scripts/verify-phase-4.sh
```

Run verification:
```bash
./scripts/verify-phase-4.sh
```

---

## Completion Checklist

Before marking Phase 4 complete, verify:

### Code Implementation
- [ ] Document processor package created (`apps/document-processor/`)
- [ ] TypeScript configuration complete
- [ ] All dependencies installed (openai, @portfolio/shared)
- [ ] Types defined (`types.ts`)
- [ ] Durable Object class implemented (`document-processor.ts`)
- [ ] Worker entry point implemented (`index.ts`)
- [ ] All processing steps working:
  - [ ] Download and chunk
  - [ ] Generate embeddings (batched)
  - [ ] Generate tags (batched)
  - [ ] Store to D1 and Vectorize
- [ ] Error handling and retry logic
- [ ] R2 reconciliation worker created (`apps/r2-reconciliation/`)

### Testing
- [ ] Unit tests written and passing (>10 tests)
- [ ] Integration tests with local development
- [ ] Test small document (<10 chunks)
- [ ] Test medium document (10-100 chunks)
- [ ] Test large document (>100 chunks)
- [ ] Test error recovery and retries
- [ ] Test reconciliation worker

### Deployment
- [ ] Wrangler configuration complete
- [ ] Environment variables configured (.dev.vars)
- [ ] Secrets set (OPENAI_API_KEY)
- [ ] Deployed to dev environment
- [ ] Health check endpoint working
- [ ] Processing endpoint working
- [ ] Status endpoint working
- [ ] Retry endpoint working

### Documentation
- [ ] README created
- [ ] API documentation complete
- [ ] Troubleshooting guide created
- [ ] Verification script passing

### Performance
- [ ] Each processing step stays under 30s CPU time
- [ ] Each step stays under 50 subrequests
- [ ] End-to-end processing < 5 minutes per document
- [ ] No memory issues with large documents

### Monitoring
- [ ] Logs accessible via `wrangler tail`
- [ ] Status queries working
- [ ] Can track progress in real-time
- [ ] Error reporting working

---

## Troubleshooting

### Issue: "Cannot find module '@portfolio/shared'"

**Solution**: Ensure shared package is built and linked:
```bash
# Build shared package
cd packages/shared
pnpm build

# Install dependencies in document-processor
cd ../../apps/document-processor
pnpm install
```

### Issue: "Durable Object not found"

**Solution**:
1. Check wrangler.jsonc has correct DO binding
2. Ensure DO class is exported from index.ts
3. Deploy with `wrangler deploy` to register DO

```typescript
// In index.ts
export { DocumentProcessor } from './document-processor';
```

### Issue: "OpenAI API rate limit exceeded"

**Solution**:
1. Check batch sizes (reduce if needed)
2. Add delay between batches
3. Upgrade OpenAI plan for higher limits

```typescript
// In document-processor.ts, after batch processing
await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
```

### Issue: "Processing stuck on embeddings step"

**Solution**:
1. Check status for errors: `curl .../status/...`
2. Check Durable Object alarms are firing
3. Retry manually: `curl -X POST .../retry/...`
4. Check Worker logs for errors

```bash
wrangler tail document-processor --env dev
```

### Issue: "Chunks not appearing in Vectorize"

**Solution**:
1. Verify Vectorize binding is correct
2. Check vector dimensions match (1536)
3. Verify upsert calls in logs
4. Query Vectorize directly:

```bash
wrangler vectorize query portfolio-embeddings-dev \
  --vector "[0.1, 0.2, ...]" \
  --top-k 5
```

### Issue: "Two-phase commit failed midway"

**Solution**:
1. Check if documents exist in D1 without chunks
2. Re-run processing (will skip document insert, complete chunks)
3. Use reconciliation to clean up:

```bash
curl -X POST https://r2-reconciliation.your-subdomain.workers.dev/reconcile
```

### Issue: "Reconciliation worker not finding documents"

**Solution**:
1. Check R2 bucket has markdown files
2. Verify D1 query is correct
3. Check Durable Object binding
4. Run manually and check logs:

```bash
curl -X POST https://r2-reconciliation.your-subdomain.workers.dev/reconcile
wrangler tail r2-reconciliation
```

### Issue: "Memory limit exceeded for large documents"

**Solution**:
1. Reduce batch sizes
2. Process fewer chunks per alarm
3. Clear processed chunk content from state:

```typescript
// After storing chunk
state.chunks[i].text = ''; // Free memory
```

---

## Performance Optimization Tips

### Reduce API Calls

- Batch embeddings (10 chunks per call)
- Batch tags (5 chunks per call)
- Reuse OpenAI client instance

### Optimize State Storage

- Store only necessary data in Durable Object
- Clear chunk content after processing
- Use structured state updates

### Improve Processing Speed

- Increase batch sizes (within limits)
- Reduce delay between alarms (but don't spam)
- Use parallel processing where safe

### Monitor Costs

- Track OpenAI API usage
- Monitor Durable Object costs
- Optimize for cost/performance balance

---

## Next Phase

After Phase 4 completion:
- **Phase 5**: Update Query Service
  - Replace Supabase with Cloudflare bindings
  - Use D1 and Vectorize for queries
  - Maintain backward compatibility

See `docs/cloudflare-migration/02-implementation-plan.md` for full timeline.

---

## Related Documents

- [Document Processor Design](../design/document-processor.md)
- [R2 Reconciliation Design](../design/r2-reconciliation.md)
- [High-Level Design](../01-high-level-design.md)
- [Implementation Plan](../02-implementation-plan.md)
- [Database Schema](../design/database-schema.md)
- [Shared Package](../design/shared-package.md)
- [Monitoring & Observability](../operations/monitoring.md)
