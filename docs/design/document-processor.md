# Document Processor Design

**Component**: Document Processing Worker with Durable Objects
**Location**: `apps/document-processor/`
**Dependencies**: R2, D1, Vectorize, Queues, OpenAI API

---

## Overview

The Document Processor is responsible for automated document ingestion triggered by R2 events. It downloads documents from R2, chunks them, generates embeddings and tags via OpenAI, and stores results in D1 and Vectorize.

### Key Challenge

A single Worker invocation processing medium/large documents will exceed:
- **30-second CPU time limit** for queue consumers
- **50 subrequest limit** per invocation (each OpenAI call counts)
- **128MB memory limit** for large documents

### Solution

Use **Durable Objects** to orchestrate a state machine-based processing pipeline where each step executes in a separate Worker invocation, staying well within limits.

---

## Decision: Durable Objects for Processing State

### Problem Statement

Processing documents involves multiple steps that can exceed Worker limits:
1. Chunking (CPU-intensive)
2. Multiple OpenAI API calls (subrequest limits)
3. Storing to multiple systems (D1 + Vectorize)

A document with 100 chunks requires 10+ OpenAI embedding calls and 10+ tag generation calls, far exceeding the 50 subrequest limit.

### Options Considered

#### Option A: D1 Tables for Processing State

**Approach**: Store processing state in D1 tables (`processing_jobs`, `batch_jobs`)

**Pros**:
- Simple SQL queries
- Easy to inspect state
- Familiar programming model

**Cons**:
- Mixes transient processing state with permanent data
- Requires complex cleanup logic for failed jobs
- Multiple table updates per processing step
- Schema bloat with processing-specific tables
- No strong consistency guarantees

#### Option B: Workers KV

**Approach**: Store state in Workers KV

**Pros**:
- Simple key-value storage
- Good for basic state tracking
- Low latency reads
- Cost-effective for small data

**Cons**:
- **Eventual consistency** (can cause race conditions)
- No complex queries or transactions
- Limited to 25MB per value
- Manual orchestration of workflow steps

#### Option C: Durable Objects (Selected)

**Approach**: Each document gets its own Durable Object instance that orchestrates processing

**Pros**:
- **Strong consistency**: Single-threaded execution model prevents race conditions
- **Automatic state persistence**: State survives Worker restarts
- **Natural workflow orchestration**: State machine pattern fits perfectly
- **Isolation**: Each document has its own DO instance
- **Built-in retries**: Automatic retry on transient failures
- **WebSocket support**: Could enable real-time progress updates
- **No cleanup needed**: State naturally expires with DO

**Cons**:
- Learning curve for developers new to DOs
- Additional complexity vs simple D1 tables
- Cost per DO instance (though minimal for this use case)
- Regional restrictions (must specify DO location)

### Decision

**Use Durable Objects** for processing orchestration.

### Rationale

1. **Solves the critical runtime limits issue** by breaking work into small steps
2. **Natural fit** for state machine-based document processing
3. **Strong consistency** prevents race conditions during parallel processing
4. **Self-contained** - each document's processing state is isolated
5. **Automatic cleanup** - no orphaned state in databases
6. **Future-proof** - enables real-time progress updates if needed

### Implementation Pattern

```typescript
export class DocumentProcessor extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/start': return this.startProcessing(request);
      case '/status': return this.getStatus();
      case '/retry': return this.retryProcessing();
    }
  }

  private async startProcessing(request: Request): Promise<Response> {
    // Initialize state and start first step
    await this.state.storage.put({
      status: 'processing',
      currentStep: 'download',
      chunks: [],
      errors: []
    });

    await this.executeStep('download');
    return new Response(JSON.stringify({ status: 'processing' }));
  }

  async alarm(): Promise<void> {
    // Continue processing when alarm fires
    const { currentStep } = await this.state.storage.get(['currentStep']);
    await this.executeStep(currentStep);
  }
}
```

---

## Decision: Chunk Content Storage

### Problem Statement

Where should we store the actual chunk text content?

### Options Considered

#### Option A: R2 Only

Store chunks as individual R2 objects.

**Pros**:
- Unlimited storage capacity
- Very low cost
- Versioning support

**Cons**:
- **50-100ms latency** per R2 fetch
- Would need to fetch dozens of chunks per query
- Query latency would be unacceptable

#### Option B: D1 (Selected)

Store chunk content directly in D1 `chunks` table.

**Pros**:
- **Low latency**: <10ms to fetch chunks
- Simple schema
- Single query retrieves all needed chunks
- Good for portfolio use case (limited dataset)

**Cons**:
- D1 storage limits (10GB per database)
- Larger database size

#### Option C: Hybrid

Store frequently accessed chunks in D1, cold chunks in R2.

**Pros**:
- Optimizes for both cost and latency

**Cons**:
- Complex cache management
- Over-engineering for this use case

### Decision

**Store chunk content in D1**.

### Rationale

1. **Query performance is critical** - Users expect <2s responses
2. **Dataset size is manageable** - Portfolio documents fit comfortably in D1 limits
3. **Simplicity** - No cache management complexity
4. **Future scaling** - Can move to hybrid approach if needed

---

## Decision: Embeddings Provider

### Problem Statement

Which service should generate embeddings?

### Options Considered

#### Option A: OpenAI (Selected)

Use OpenAI's `text-embedding-3-small` model (1536 dimensions).

**Pros**:
- **Proven quality** with current pipeline
- Mature API with good reliability
- Well-documented
- Current codebase already uses it

**Cons**:
- External dependency
- Cost: $0.02 per 1M tokens
- Rate limits to manage

#### Option B: Workers AI

Use Cloudflare's Workers AI embedding models (e.g., `@cf/baai/bge-base-en-v1.5`).

**Pros**:
- Native Cloudflare integration
- Lower cost
- No external dependencies
- No rate limits

**Cons**:
- **Still in beta** - may have stability issues
- **Lower dimensions** (768 vs 1536) - may impact quality
- **Different model** - would require regenerating all embeddings
- Less battle-tested

### Decision

**Start with OpenAI**, consider Workers AI later.

### Rationale

1. **Risk mitigation** - Use proven technology for initial migration
2. **Quality assurance** - Maintain current embedding quality
3. **Faster migration** - No need to test new embedding model
4. **Easy to swap later** - Can migrate to Workers AI once it's stable

### Migration Path

When Workers AI is production-ready:
1. Generate new embeddings for all documents
2. A/B test answer quality
3. Gradually migrate if quality is acceptable

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Processor                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────────────┐         │
│  │Queue Consumer│────────▶│   Main Worker        │         │
│  └──────────────┘         │  - Delegates to DO   │         │
│                           │  - Manual triggers   │         │
│                           └──────────┬───────────┘         │
│                                      │                       │
│                           ┌──────────▼───────────┐         │
│                           │ DocumentProcessor DO │         │
│                           │  ┌────────────────┐  │         │
│                           │  │ State Machine  │  │         │
│                           │  │  - download    │  │         │
│                           │  │  - embeddings  │  │         │
│                           │  │  - tags        │  │         │
│                           │  │  - store       │  │         │
│                           │  └────────────────┘  │         │
│                           └──────────────────────┘         │
│                                      │                       │
│                    ┌─────────────────┼────────────────┐    │
│                    ▼                 ▼                ▼    │
│              ┌─────────┐      ┌──────────┐    ┌─────────┐ │
│              │   R2    │      │   D1     │    │Vectorize│ │
│              └─────────┘      └──────────┘    └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Bindings Configuration

```jsonc
{
  "name": "document-processor",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",

  "r2_buckets": [{
    "binding": "DOCUMENTS_BUCKET",
    "bucket_name": "portfolio-documents"
  }],

  "d1_databases": [{
    "binding": "DB",
    "database_name": "portfolio-db"
  }],

  "vectorize": [{
    "binding": "VECTORIZE",
    "index_name": "portfolio-embeddings"
  }],

  "durable_objects": {
    "bindings": [{
      "name": "DOCUMENT_PROCESSOR",
      "class_name": "DocumentProcessor",
      "script_name": "document-processor"
    }]
  },

  "queues": {
    "producers": [{
      "binding": "PROCESSING_QUEUE",
      "queue": "document-processing"
    }]
  }
}
```

---

## State Machine Implementation

### State Diagram

```
┌──────────────┐
│ not_started  │
└──────┬───────┘
       │ /start
       ▼
┌──────────────┐
│  processing  │────────┐
└──────┬───────┘        │
       │                │
       ├─▶ download     │
       ├─▶ embeddings   │ (error) ──▶ retry ──▶ (3x) ──▶ failed
       ├─▶ tags         │
       ├─▶ store        │
       │                │
       ▼                │
┌──────────────┐        │
│  completed   │◀───────┘
└──────────────┘
```

### State Schema

```typescript
interface ProcessingState {
  status: 'not_started' | 'processing' | 'completed' | 'failed';
  r2Key: string;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;

  // Current execution
  currentStep: 'download' | 'embeddings' | 'tags' | 'store';

  // Document data
  metadata?: DocumentMetadata;
  content?: string;
  documentTags?: string[];

  // Chunks
  chunks: Array<{
    index: number;
    text: string;
    embedding: number[] | null;
    tags: string[] | null;
    status: 'pending' | 'embedding_done' | 'tags_done' | 'stored';
  }>;
  totalChunks: number;
  processedChunks: number;

  // Batch processing
  embeddingBatchIndex: number;
  tagsBatchIndex: number;

  // Error handling
  errors: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
  retryCount: number;
}
```

---

## Processing Pipeline

### Step 1: Download and Chunk

**Duration**: < 5 seconds
**Subrequests**: 1 (R2 download)

```typescript
private async downloadAndChunk(): Promise<void> {
  const { r2Key } = await this.state.storage.get(['r2Key']);

  // Download from R2
  const object = await this.env.DOCUMENTS_BUCKET.get(r2Key);
  if (!object) throw new Error(`Object ${r2Key} not found`);

  const content = await object.text();

  // Parse metadata from document
  const metadata = this.parseMetadata(r2Key, content);

  // Chunk document (CPU-bound but fast)
  const chunks = chunkMarkdown(content);

  // Store state
  await this.state.storage.put({
    metadata,
    content,
    chunks: chunks.map((text, index) => ({
      index, text,
      embedding: null,
      tags: null,
      status: 'pending'
    })),
    totalChunks: chunks.length,
    currentStep: 'embeddings',
    embeddingBatchIndex: 0
  });

  // Schedule next step
  this.state.storage.setAlarm(Date.now() + 100);
}
```

### Step 2: Generate Embeddings (Batched)

**Duration**: < 15 seconds per batch
**Batch Size**: 10 chunks
**Subrequests**: 1 (OpenAI API)

```typescript
private async generateEmbeddingsBatch(): Promise<void> {
  const BATCH_SIZE = 10;

  const state = await this.state.storage.get([
    'chunks', 'embeddingBatchIndex', 'totalChunks'
  ]);

  const startIndex = state.embeddingBatchIndex || 0;
  const chunks = state.chunks.slice(startIndex, startIndex + BATCH_SIZE);

  if (chunks.length === 0) {
    // All embeddings done, move to tags
    await this.state.storage.put({
      currentStep: 'tags',
      tagsBatchIndex: 0
    });
    this.state.storage.setAlarm(Date.now() + 100);
    return;
  }

  // Generate embeddings for this batch
  const texts = chunks.map(c => c.text);
  const embeddings = await this.generateEmbeddings(texts);

  // Update chunks with embeddings
  const allChunks = await this.state.storage.get('chunks');
  chunks.forEach((chunk, i) => {
    allChunks[startIndex + i].embedding = embeddings[i];
    allChunks[startIndex + i].status = 'embedding_done';
  });

  await this.state.storage.put({
    chunks: allChunks,
    embeddingBatchIndex: startIndex + BATCH_SIZE,
    processedChunks: startIndex + chunks.length
  });

  // Continue with next batch
  this.state.storage.setAlarm(Date.now() + 100);
}
```

### Step 3: Generate Tags (Batched)

**Duration**: < 20 seconds per batch
**Batch Size**: 5 chunks (fewer because tag generation uses more tokens)
**Subrequests**: 1-2 (OpenAI API)

```typescript
private async generateTagsBatch(): Promise<void> {
  const BATCH_SIZE = 5;

  const state = await this.state.storage.get([
    'chunks', 'content', 'tagsBatchIndex'
  ]);

  const startIndex = state.tagsBatchIndex || 0;
  const chunks = state.chunks.slice(startIndex, startIndex + BATCH_SIZE);

  if (chunks.length === 0) {
    // Generate document-level tags
    const documentTags = await this.generateTags(state.content);

    await this.state.storage.put({
      documentTags,
      currentStep: 'store'
    });
    this.state.storage.setAlarm(Date.now() + 100);
    return;
  }

  // Generate tags for this batch
  const texts = chunks.map(c => c.text);
  const tags = await this.batchGenerateTags(texts);

  // Update chunks with tags
  const allChunks = await this.state.storage.get('chunks');
  chunks.forEach((chunk, i) => {
    allChunks[startIndex + i].tags = tags[i];
    allChunks[startIndex + i].status = 'tags_done';
  });

  await this.state.storage.put({
    chunks: allChunks,
    tagsBatchIndex: startIndex + BATCH_SIZE
  });

  // Continue with next batch
  this.state.storage.setAlarm(Date.now() + 100);
}
```

### Step 4: Store to D1 and Vectorize

**Duration**: < 10 seconds
**Subrequests**: Multiple (D1 + Vectorize operations)

**Two-Phase Commit Pattern**:
1. Store in Vectorize first (idempotent with upsert)
2. Only commit to D1 after Vectorize succeeds
3. Ensures consistency between systems

```typescript
private async storeToD1AndVectorize(): Promise<void> {
  const state = await this.state.storage.get([
    'r2Key', 'metadata', 'documentTags', 'chunks'
  ]);

  const jobId = crypto.randomUUID();

  try {
    // Phase 1: Store document metadata in D1
    const docResult = await this.env.DB.prepare(`
      INSERT INTO documents (content_hash, company_id, project, tags, r2_key)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      state.metadata.contentHash,
      state.metadata.companyId,
      state.metadata.project,
      JSON.stringify(state.documentTags),
      state.r2Key
    ).first();

    const documentId = docResult.id;

    // Phase 2: Store chunks (Vectorize first, then D1)
    const chunkPromises = state.chunks.map(async (chunk, index) => {
      const vectorizeId = `${jobId}-${index}`;

      // Store in Vectorize first (idempotent with upsert)
      await this.env.VECTORIZE.upsert([{
        id: vectorizeId,
        values: chunk.embedding,
        metadata: {
          document_id: documentId,
          tags: chunk.tags,
          chunk_index: index
        }
      }]);

      // Then store in D1
      await this.env.DB.prepare(`
        INSERT INTO chunks (content, document_id, type, tags, vectorize_id)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        chunk.text,
        documentId,
        'markdown',
        JSON.stringify(chunk.tags),
        vectorizeId
      ).run();
    });

    await Promise.all(chunkPromises);

    // Success - mark as complete
    await this.state.storage.put({
      status: 'completed',
      currentStep: 'complete',
      documentId,
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    await this.handleStorageError(error);
  }
}
```

---

## Error Handling

### Retry Logic

```typescript
private async handleError(step: string, error: any): Promise<void> {
  const { retryCount = 0, errors = [] } = await this.state.storage.get([
    'retryCount', 'errors'
  ]);

  errors.push({
    step,
    error: error.message,
    timestamp: new Date().toISOString()
  });

  if (retryCount < 3) {
    // Retry with exponential backoff
    await this.state.storage.put({
      retryCount: retryCount + 1,
      errors
    });

    const delayMs = Math.pow(2, retryCount) * 1000;
    this.state.storage.setAlarm(Date.now() + delayMs);
  } else {
    // Max retries exceeded
    await this.state.storage.put({
      status: 'failed',
      errors,
      failedAt: new Date().toISOString()
    });
  }
}
```

---

## API Endpoints

### Start Processing

```typescript
POST /process
{
  "r2Key": "experiments/webforms.md"
}

Response: {
  "status": "queued",
  "message": "Document queued for processing"
}
```

### Get Status

```typescript
GET /status/:r2Key

Response: {
  "status": "processing",
  "currentStep": "embeddings",
  "progress": {
    "totalChunks": 50,
    "processedChunks": 25,
    "percentage": 50
  },
  "errors": [],
  "timing": {
    "startedAt": "2025-11-01T10:00:00Z"
  }
}
```

### Retry Failed Job

```typescript
POST /retry/:r2Key

Response: {
  "status": "processing",
  "message": "Processing restarted"
}
```

---

## Worker Entry Point

```typescript
export default {
  // Handle R2 event notifications via queue
  async queue(batch: MessageBatch<{r2Key: string}>, env: Env) {
    for (const message of batch.messages) {
      const { r2Key } = message.body;

      // Get or create DO instance for this document
      const processorId = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
      const processor = env.DOCUMENT_PROCESSOR.get(processorId);

      // Start processing
      const response = await processor.fetch(
        new Request('http://do/start', {
          method: 'POST',
          body: JSON.stringify({ r2Key })
        })
      );

      if (response.ok) {
        message.ack();
      } else {
        message.retry({ delaySeconds: Math.pow(2, message.attempts) * 10 });
      }
    }
  },

  // Manual trigger and status endpoints
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === '/process') {
      const { r2Key } = await request.json();
      await env.PROCESSING_QUEUE.send({ r2Key });
      return new Response(JSON.stringify({
        status: 'queued',
        message: `Document ${r2Key} queued for processing`
      }));
    }

    if (url.pathname.startsWith('/status/')) {
      const r2Key = url.pathname.substring(8);
      const processorId = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
      const processor = env.DOCUMENT_PROCESSOR.get(processorId);
      return await processor.fetch(new Request('http://do/status'));
    }

    return new Response('Not found', { status: 404 });
  }
};

// Export Durable Object class
export { DocumentProcessor } from './document-processor';
```

---

## Benefits

1. **Solves Worker Runtime Limits**: Each step stays well within 30s CPU and 50 subrequest limits
2. **Strong Consistency**: Single-threaded DO execution prevents race conditions
3. **Automatic State Persistence**: Processing state survives Worker restarts
4. **Natural Progress Tracking**: Can query status at any time
5. **Self-Healing**: Automatic retries with exponential backoff
6. **Clean Separation**: Processing state separate from permanent data in D1
7. **Scalable**: Can process documents of any size

---

## Testing Strategy

### Unit Tests
- Test each processing step in isolation
- Mock OpenAI API responses
- Test error handling and retries
- Test state transitions

### Integration Tests
- Test full pipeline with real DO
- Test with various document sizes
- Test concurrent processing
- Test failure recovery

### Performance Tests
- Verify each step stays under time limits
- Test with maximum batch sizes
- Measure end-to-end latency

---

## Related Documents

- [High-Level Design](./cloudflare-migration-high-level.md)
- [Database Schema](./database-schema.md)
- [R2 Reconciliation](./r2-reconciliation.md)
- [Shared Package](./shared-package.md)
- [Monitoring & Observability](../operations/monitoring.md)
