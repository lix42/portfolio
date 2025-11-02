# Cloudflare Stack Migration Plan

**Model**: Claude Sonnet 4.5
**Date**: November 1, 2025
**Task**: Migrate from Supabase (PostgreSQL + pgvector) to Cloudflare (R2 + D1 + Vectorize + Workers)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Target Architecture](#target-architecture)
4. [Key Decisions](#key-decisions)
5. [Migration Components](#migration-components)
6. [Implementation Plan](#implementation-plan)
7. [Risk Assessment](#risk-assessment)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Strategy](#deployment-strategy)

---

## Executive Summary

This document outlines the migration plan for the Portfolio RAG Assistant from a Supabase-based architecture to Cloudflare's edge-native stack. The migration involves:

- **Storage**: Moving from Supabase storage to R2 for document storage
- **Database**: Migrating from PostgreSQL to D1 for structured data (companies, documents metadata, chunks metadata)
- **Vector Search**: Replacing pgvector with Cloudflare Vectorize
- **Ingestion Pipeline**: Replacing Python client-side scripts with a Worker-based event-driven architecture
- **Query Service**: Updating TypeScript service to use Cloudflare bindings instead of Supabase client

---

## Current Architecture Analysis

### Data Flow

#### Ingestion (Python Scripts)
1. **Local documents** → Read from `documents/experiments/*.json` and `*.md` files
2. **Chunking** → Split markdown into context-aware chunks (max 800 tokens)
3. **Embedding** → Generate OpenAI embeddings (text-embedding-3-small, 1536 dimensions)
4. **Tag Generation** → LLM-powered tag extraction for both documents and chunks
5. **Storage** → Upsert to Supabase (companies, documents, chunks tables)

#### Query (TypeScript Service)
1. **User question** → Preprocess with LLM (extract tags, validate)
2. **Embed question** → Generate embedding for semantic search
3. **Hybrid search** → Combine vector similarity + tag matching
4. **Ranking** → Weight-based scoring (embedding: 0.8, tags: 1.0 per match)
5. **Answer generation** → GPT-4 with retrieved context

### Database Schema

#### Tables
- **companies**: `id`, `name`, `start_time`, `end_time`, `title`, `description`
- **documents**: `id`, `content`, `content_hash`, `company_id`, `tags[]`, `project`, `created_at`, `updated_at`
- **chunks**: `id`, `content`, `embedding[1536]`, `tags[]`, `tags_embedding[1536]`, `document_id`, `type`, `created_at`, `updated_at`

#### Key Features
- Vector similarity search using HNSW index
- Tag-based search using GIN indexes
- Custom RPC functions: `match_chunks_by_embedding`, `match_chunks_by_tags`
- Foreign key constraints with CASCADE delete

---

## Target Architecture

### Cloudflare Components

#### 1. R2 Buckets
**Purpose**: Store original documents (markdown files, JSON metadata)

**Structure**:
```
documents/
  companies.json
  experiments/
    network_request_middleware.json
    network_request_middleware.md
    webforms.json
    webforms.md
```

**Note**: `prompts.json` is NOT stored in R2 as it's part of business logic shared by both ingestion and query services. It will be moved to `packages/shared`.

**Benefits**:
- Versioning support for document history
- Event notifications for automated processing
- Low-cost object storage
- Global edge distribution

#### 2. D1 Database
**Purpose**: Store relational data (companies, document metadata, chunk metadata)

**Schema** (reflects decisions in Key Decisions section):
```sql
-- companies table
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_time TEXT NOT NULL, -- ISO date string
  end_time TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- documents table
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_hash TEXT NOT NULL UNIQUE,
  company_id INTEGER NOT NULL,
  project TEXT NOT NULL UNIQUE,
  tags TEXT NOT NULL, -- JSON array as TEXT
  r2_key TEXT NOT NULL, -- Path to full content in R2
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- chunks table
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL, -- Store chunk content directly (Decision 1)
  document_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  tags TEXT NOT NULL, -- JSON array as TEXT (Decision 4: Hybrid approach)
  vectorize_id TEXT NOT NULL UNIQUE, -- ID in Vectorize index
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- processing_jobs table (NEW)
CREATE TABLE processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed', 'batch_pending'
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- batch_jobs table (NEW - for OpenAI Batch API)
CREATE TABLE batch_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openai_batch_id TEXT NOT NULL UNIQUE,
  processing_job_id INTEGER NOT NULL,
  type TEXT NOT NULL,  -- 'embeddings' or 'tags'
  status TEXT NOT NULL,  -- 'pending', 'completed', 'failed'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (processing_job_id) REFERENCES processing_jobs(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_tags ON chunks(tags); -- For JSON search optimization
CREATE INDEX idx_documents_project ON documents(project);
CREATE INDEX idx_documents_company_id ON documents(company_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_r2_key ON processing_jobs(r2_key);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_batch_jobs_processing_job_id ON batch_jobs(processing_job_id);
```

**Notes**:
- **INTEGER PRIMARY KEY** used for all IDs (Decision 2: Better performance than TEXT/UUIDs)
- **Chunk content stored in D1** (Decision 1: Lower latency than R2 fetches)
- Tags stored as JSON text (D1 doesn't support array columns)
- No native vector support (vectors stored in Vectorize separately)
- Dates stored as ISO strings (SQLite datetime functions compatible)
- `batch_jobs` table tracks OpenAI Batch API processing

#### 3. Vectorize
**Purpose**: Vector similarity search

**Configuration**:
- Index name: `portfolio-embeddings`
- Dimensions: 1536 (matching OpenAI text-embedding-3-small)
- Metric: cosine similarity

**Data Structure**:
```typescript
{
  id: string,           // Unique vector ID (chunk.vectorize_id)
  values: number[],     // 1536-dimensional embedding
  metadata: {
    chunk_id: string,   // D1 chunks.id
    document_id: string,
    tags: string[]
  }
}
```

#### 4. Workers

##### A. Document Sync Client (CLI Tool)
**Purpose**: Local tool to sync documents folder with R2

**Features**:
- Compare local files with R2 state
- Upload new/modified files
- Delete removed files
- Generate metadata for tracking
- Display sync status

##### B. Document Processing Worker
**Purpose**: Event-driven document processing

**Triggers**:
- R2 event notifications (object created/updated/deleted)
- Manual API calls for reprocessing

**Responsibilities**:
- Download document from R2
- Parse metadata
- Chunk markdown content
- Generate embeddings via OpenAI
- Generate tags via OpenAI
- Store in D1 + Vectorize
- Track processing status

##### C. Query Service Worker (Existing, Modified)
**Purpose**: Handle RAG queries

**Changes**:
- Replace Supabase client with D1/Vectorize/R2 bindings
- Implement hybrid search logic
- Fetch full documents from R2 when needed

---

## Key Decisions

This section discusses critical architectural decisions that will impact the migration's success, performance, and maintainability.

---

### Decision 1: Chunk Content Storage - D1 vs R2

**Question**: Should we store chunk content in D1's `chunks` table or in R2?

#### Option A: Store in D1 (Recommended)

**Pros**:
- **Lower latency**: Direct SQL query returns content immediately
- **Simpler code**: No need for separate R2 fetches
- **Atomic operations**: Content and metadata updated together
- **Better for hybrid search**: Can filter/sort by content in SQL
- **Consistent with current architecture**: Matches Supabase approach

**Cons**:
- **Storage costs**: D1 storage is more expensive than R2 (~$1/GB vs $0.015/GB)
- **Size limits**: D1 row size limit is 1MB (but chunks are ~800 tokens = ~3KB)
- **Database bloat**: Large content fields can slow down table scans

**Analysis**:
- Average chunk size: ~800 tokens = ~3KB text
- 1000 chunks = ~3MB total (well within D1 limits)
- Even 10,000 chunks = ~30MB (negligible D1 storage cost)
- Latency impact: R2 fetch adds 50-100ms per chunk retrieval

**Decision**: **Store content in D1**

**Rationale**:
1. Chunks are small (3KB average), so storage cost difference is negligible
2. Query latency is critical for user experience
3. Simpler code reduces complexity and bugs
4. Current architecture proves this pattern works well

**Schema**:
```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,  -- Store directly in D1
  document_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  tags TEXT NOT NULL,
  vectorize_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

---

### Decision 2: ID Type - TEXT (UUID) vs INTEGER

**Question**: Should we use TEXT for UUIDs or INTEGER for auto-increment IDs?

#### Option A: TEXT with UUIDs (Current Approach)

**Pros**:
- **Globally unique**: No coordination needed across systems
- **Security**: Harder to enumerate/guess IDs
- **Compatibility**: Matches Supabase schema (easier migration)
- **Distributed systems**: Works well with multiple workers

**Cons**:
- **Storage overhead**: 36 bytes vs 8 bytes for INTEGER
- **Performance**: String comparisons slower than integer
- **Index size**: Larger indexes = more memory

#### Option B: INTEGER with Auto-increment (Recommended)

**Pros**:
- **Better performance**: Integer comparisons are 2-3x faster
- **Smaller indexes**: Less memory, faster lookups
- **Native D1 support**: `AUTOINCREMENT` is optimized
- **Simpler debugging**: Easier to read logs and queries
- **Smaller storage**: 8 bytes vs 36 bytes per ID

**Cons**:
- **Not globally unique**: Need coordination if multiple writers
- **Predictable**: IDs can be enumerated (security consideration)
- **Migration complexity**: Need to map UUIDs → INTEGERs

**Analysis**:
- Single-writer architecture: Document processor is the only writer
- Performance matters: IDs used in every query join
- D1 optimization: SQLite is heavily optimized for INTEGER PRIMARY KEY
- Security: Portfolio data is not sensitive enough to require UUID obfuscation

**Decision**: **Use INTEGER PRIMARY KEY with AUTOINCREMENT**

**Rationale**:
1. Better performance (2-3x faster joins)
2. Simpler schema aligned with SQLite best practices
3. Single writer pattern eliminates coordination concerns
4. Smaller database size and indexes

**Migration strategy**:
```sql
-- Create mapping table during migration
CREATE TABLE uuid_id_mapping (
  uuid TEXT PRIMARY KEY,
  new_id INTEGER NOT NULL,
  table_name TEXT NOT NULL
);

-- Use this for foreign key mapping during migration
-- Then drop once migration is complete
```

**Updated Schema**:
```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  ...
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  ...
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  ...
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

---

### Decision 3: Embedding Generation - OpenAI vs Cloudflare Workers AI

**Question**: Should we use OpenAI embeddings or Cloudflare Workers AI for generating embeddings?

#### Option A: OpenAI (Current Approach)

**Model**: `text-embedding-3-small`
**Dimensions**: 1536

**Pros**:
- **Proven quality**: Best-in-class embeddings
- **Consistency**: Matches existing Supabase data
- **Stability**: Production-ready, reliable API
- **No migration needed**: Same model, same embeddings
- **Documentation**: Extensive examples and support

**Cons**:
- **Cost**: $0.02 per 1M tokens (~$0.20 per 10K chunks)
- **External dependency**: Network latency, rate limits
- **Vendor lock-in**: Tied to OpenAI pricing/availability

#### Option B: Cloudflare Workers AI

**Model**: `@cf/baai/bge-base-en-v1.5` or similar
**Dimensions**: 768

**Pros**:
- **Lower cost**: $0.001 per 1K inferences (10-20x cheaper)
- **Lower latency**: Runs on edge, no external API calls
- **No rate limits**: Scales with Workers
- **Privacy**: Data stays within Cloudflare network
- **Simpler architecture**: Fewer external dependencies

**Cons**:
- **Different dimensions**: 768 vs 1536 (requires new Vectorize index)
- **Quality trade-off**: May have lower accuracy than OpenAI
- **Migration complexity**: All embeddings must be regenerated
- **Less mature**: Newer service, less battle-tested
- **Different model**: Need to validate quality for our use case

**Analysis**:

**Cost Comparison** (10K chunks, regenerated 10x per year):
- OpenAI: $0.20 × 10 = $2/year
- Workers AI: $0.01 × 10 = $0.10/year
- **Savings**: ~$2/year (negligible)

**Latency Comparison**:
- OpenAI: 100-200ms per batch
- Workers AI: 10-50ms per inference
- **Impact**: Faster processing, but not critical for async pipeline

**Quality Comparison**:
- OpenAI: Industry-leading semantic search quality
- Workers AI: Good quality, but needs validation for our domain

**Decision**: **Start with OpenAI, evaluate Workers AI later**

**Rationale**:
1. **Cost is negligible**: $2/year difference doesn't justify migration risk
2. **Quality is proven**: OpenAI embeddings work well for current use case
3. **Consistency**: No need to regenerate all embeddings
4. **Risk reduction**: One less migration dependency
5. **Future option**: Can switch later without architectural changes

**Migration Path**:
- **Phase 1**: Use OpenAI (safe, proven)
- **Phase 2**: Run A/B test with Workers AI on subset of queries
- **Phase 3**: If quality is acceptable, migrate to Workers AI for cost optimization

**Hybrid approach** (future consideration):
```typescript
// Use Workers AI for real-time queries (low latency)
// Use OpenAI for document processing (high quality)
const embedding = isRealTimeQuery
  ? await generateEmbeddingWorkersAI(text, env.AI)
  : await generateEmbeddingOpenAI(text, env.OPENAI_API_KEY);
```

---

### Decision 4: Tag-Based Search Strategy

**Question**: How should we implement tag-based chunk search in D1 without native array support?

**Requirement**: Find chunks where `tags` array overlaps with input tags, ranked by match count.

#### Option A: JSON Functions (Recommended for Simplicity)

**Approach**: Store tags as JSON array in TEXT column, use SQLite JSON functions

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tags TEXT NOT NULL,  -- JSON: ["tag1", "tag2"]
  ...
);

-- Query: Find chunks matching any of the input tags
SELECT
  c.*,
  (
    SELECT COUNT(*)
    FROM json_each(c.tags) AS ct
    WHERE ct.value IN (SELECT value FROM json_each(?1))
  ) AS match_count
FROM chunks c
WHERE EXISTS (
  SELECT 1
  FROM json_each(c.tags) AS ct
  WHERE ct.value IN (SELECT value FROM json_each(?1))
)
ORDER BY match_count DESC
LIMIT ?2;
```

**Pros**:
- **Simple schema**: Just TEXT column
- **Native support**: SQLite JSON functions are fast
- **Flexible**: Easy to add/remove tags
- **Debuggable**: Can inspect JSON in SQL console

**Cons**:
- **No indexes**: Can't create index on JSON array elements in D1
- **Full table scan**: O(n) performance for tag queries
- **Slower for large datasets**: No index optimization

**Performance**: ~10-50ms for 1,000 chunks, ~100-200ms for 10,000 chunks

---

#### Option B: Normalized Tags Table (Best Performance)

**Approach**: Create separate `chunk_tags` junction table with indexes

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE chunk_tags (
  chunk_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (chunk_id, tag_id),
  FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_chunk_tags_tag_id ON chunk_tags(tag_id);

-- Query: Find chunks matching any of the input tags
SELECT
  c.*,
  COUNT(DISTINCT ct.tag_id) AS match_count
FROM chunks c
JOIN chunk_tags ct ON c.id = ct.chunk_id
JOIN tags t ON ct.tag_id = t.id
WHERE t.name IN ('tag1', 'tag2', 'tag3')
GROUP BY c.id
ORDER BY match_count DESC
LIMIT ?;
```

**Pros**:
- **Indexed**: Fast lookups via `idx_chunk_tags_tag_id`
- **Best performance**: O(log n) for tag matching
- **Scalable**: Handles 100K+ chunks efficiently
- **Normalized**: Tags stored once, referenced by ID

**Cons**:
- **Complex schema**: 2 extra tables, more joins
- **Write overhead**: Insert/delete to multiple tables
- **Migration complexity**: Need to denormalize existing tags
- **Over-engineering**: May be overkill for small dataset

**Performance**: ~5-10ms for 1,000 chunks, ~10-20ms for 10,000 chunks

---

#### Option C: Vectorize Metadata Filtering (Recommended)

**Approach**: Store tags in Vectorize metadata and use metadata filtering

```typescript
// Store in Vectorize with metadata
await env.VECTORIZE.insert([{
  id: vectorizeId,
  values: embedding,
  metadata: {
    chunk_id: chunkId,
    document_id: documentId,
    tags: ['tag1', 'tag2', 'tag3']  // Vectorize supports array metadata
  }
}]);

// Query: Filter by tags during vector search
const results = await env.VECTORIZE.query(queryEmbedding, {
  topK: 50,
  returnMetadata: 'all',
  filter: {
    tags: { $in: inputTags }  // Filter by tag overlap
  }
});
```

**Pros**:
- **No D1 complexity**: Tag search happens in Vectorize
- **Fast**: Vectorize is optimized for metadata filtering
- **Unified search**: Combine vector similarity + tag filter in one query
- **Simpler D1 schema**: No need for tag columns or tables
- **Best architecture**: Leverages Vectorize capabilities

**Cons**:
- **Vectorize dependency**: Can't do tag-only search without embeddings
- **Metadata limits**: May have size/complexity restrictions
- **Less flexible**: Can't do complex tag aggregations
- **Documentation**: Vectorize metadata filtering is newer feature

**Performance**: ~10-30ms (combines vector + tag search)

---

#### Option D: Hybrid - D1 JSON + Vectorize Metadata (Recommended)

**Approach**: Store tags in both D1 (for flexibility) and Vectorize (for performance)

```sql
-- D1: Store tags as JSON for fallback and aggregations
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  tags TEXT NOT NULL,  -- JSON array
  vectorize_id TEXT NOT NULL UNIQUE,
  ...
);
```

```typescript
// Vectorize: Store same tags in metadata
await env.VECTORIZE.insert([{
  id: vectorizeId,
  values: embedding,
  metadata: {
    chunk_id: chunkId,
    tags: tags  // Same tags from D1
  }
}]);

// Query strategy:
// 1. Use Vectorize metadata filter for primary search
// 2. Fall back to D1 JSON query if Vectorize fails
// 3. Use D1 for analytics/debugging
```

**Pros**:
- **Best of both worlds**: Fast Vectorize filtering + D1 flexibility
- **Resilient**: Fallback if Vectorize has issues
- **Debuggable**: Can inspect tags in D1 directly
- **Future-proof**: Can optimize either path independently

**Cons**:
- **Data duplication**: Tags stored in 2 places
- **Sync complexity**: Must keep tags in sync
- **Storage overhead**: Minimal (~1-2 KB per chunk)

---

#### **Final Decision: Option D - Hybrid Approach**

**Rationale**:
1. **Performance**: Vectorize metadata filtering is fastest for hybrid search
2. **Resilience**: D1 fallback ensures reliability
3. **Flexibility**: D1 tags enable analytics and debugging
4. **Simple schema**: No normalized tables, just JSON in D1
5. **Future-proof**: Can optimize either path without migration

**Implementation**:
```typescript
// Primary: Vectorize metadata filter
async function searchByTags(tags: string[], env: Env): Promise<Chunk[]> {
  try {
    // Try Vectorize first (fastest)
    const vectorResults = await env.VECTORIZE.query(
      zeroVector,  // Use zero vector for tag-only search
      {
        topK: TAG_MATCH_COUNT,
        returnMetadata: 'all',
        filter: { tags: { $containsAny: tags } }
      }
    );

    // Fetch full chunks from D1
    const chunkIds = vectorResults.matches.map(m => m.metadata.chunk_id);
    return await fetchChunksByIds(chunkIds, env.DB);

  } catch (error) {
    // Fallback: D1 JSON query
    console.warn('Vectorize tag search failed, falling back to D1:', error);
    return await searchByTagsD1(tags, env.DB);
  }
}

// Fallback: D1 JSON query
async function searchByTagsD1(tags: string[], db: D1Database): Promise<Chunk[]> {
  const tagsJson = JSON.stringify(tags);
  const result = await db.prepare(`
    SELECT
      c.*,
      (
        SELECT COUNT(*)
        FROM json_each(c.tags) AS ct
        WHERE ct.value IN (SELECT value FROM json_each(?))
      ) AS match_count
    FROM chunks c
    WHERE EXISTS (
      SELECT 1
      FROM json_each(c.tags) AS ct
      WHERE ct.value IN (SELECT value FROM json_each(?))
    )
    ORDER BY match_count DESC
    LIMIT ?
  `).bind(tagsJson, tagsJson, TAG_MATCH_COUNT).all();

  return result.results.map(row => parseChunk(row));
}
```

**Performance Targets**:
- Vectorize path: <30ms (includes D1 fetch)
- D1 fallback path: <100ms for 1,000 chunks

---

### Decision 5: Shared Configuration Location

**Question**: Where should `prompts.json` and other shared business logic live?

**Current**: `documents/prompts.json` (mixed with document data)

**Problem**:
- `prompts.json` is business logic, not document data
- Needs to be shared by both document processor and query service
- Shouldn't be uploaded to R2 with documents

**Decision**: **Create `packages/shared` package**

**Structure**:
```
packages/shared/
├── src/
│   ├── prompts.ts          # Typed exports of prompt templates
│   ├── constants.ts         # Shared constants (MODEL, CHUNK_MAX_TOKENS)
│   └── types.ts             # Shared TypeScript types
├── data/
│   └── prompts.json         # Raw prompt data
├── package.json
└── tsconfig.json
```

**Usage**:
```typescript
// In document-processor or service
import {
  defineTagsPrompt,
  preprocessQuestionPrompt,
  answerQuestionPrompt
} from '@portfolio/shared';

// Type-safe, versioned prompts
const systemPrompt = defineTagsPrompt.join('\n');
```

**Benefits**:
- **Separation of concerns**: Business logic separate from document data
- **Type safety**: TypeScript types for prompts
- **Versioning**: Can version prompts with code
- **Reusability**: Single source of truth for all workers
- **No R2 upload**: Not part of document sync

---

## Migration Components

### Component 1: R2 Document Sync Client

**Location**: `apps/r2-sync/` (standalone CLI tool + library)

**Dependencies**:
- `@cloudflare/workers-types`
- `wrangler` for R2 API access
- `commander` for CLI interface
- `chalk` for colored output
- `@portfolio/shared` for shared utilities

**Features**:
1. **List local documents**: Scan `documents/` folder
2. **List R2 objects**: Query R2 bucket
3. **Compute diff**: Compare by content hash (SHA-256)
4. **Sync operations**:
   - Upload new files
   - Update modified files
   - Delete removed files (with confirmation)
5. **Dry-run mode**: Preview changes without executing
6. **Progress reporting**: Show upload/delete status with progress bars
7. **CI/CD support**: Exit codes and JSON output for automation

**CLI Interface**:
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

**CI/CD Integration**:

**GitHub Actions Example**:
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
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Sync to R2
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          pnpm sync:r2 --ci --json > sync-result.json
          cat sync-result.json

      - name: Upload sync report
        uses: actions/upload-artifact@v3
        with:
          name: sync-report
          path: sync-result.json
```

**Exit Codes** (for CI/CD):
- `0`: Success (all files synced)
- `1`: Sync errors (some files failed)
- `2`: Configuration error (missing env vars, invalid paths)
- `3`: Connection error (R2 unreachable)

**JSON Output** (for CI/CD):
```json
{
  "success": true,
  "timestamp": "2025-11-01T10:30:00Z",
  "summary": {
    "uploaded": 3,
    "updated": 1,
    "deleted": 0,
    "skipped": 5,
    "failed": 0
  },
  "files": [
    {
      "path": "experiments/webforms.md",
      "action": "uploaded",
      "size": 12345,
      "hash": "abc123..."
    }
  ],
  "errors": []
}
```

**Programmatic API** (for custom scripts):
```typescript
import { R2Syncer } from '@portfolio/r2-sync';

const syncer = new R2Syncer({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  bucketName: 'portfolio-documents',
  localPath: './documents'
});

// Sync with options
const result = await syncer.sync({
  dryRun: false,
  allowDelete: true,
  exclude: ['*.tmp', '.DS_Store'],
  onProgress: (file, progress) => {
    console.log(`Uploading ${file}: ${progress}%`);
  }
});

console.log(`Synced ${result.uploaded} files`);
```

---

### Component 2: Document Processing Worker

**Location**: `apps/document-processor/` or extend existing `apps/service/`

**Bindings**:
```jsonc
{
  "r2_buckets": [
    {
      "binding": "DOCUMENTS_BUCKET",
      "bucket_name": "portfolio-documents"
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "portfolio-db"
    }
  ],
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "portfolio-embeddings"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "PROCESSING_QUEUE",
        "queue": "document-processing"
      }
    ],
    "consumers": [
      {
        "queue": "document-processing",
        "max_batch_size": 1,
        "max_batch_timeout": 60
      }
    ]
  }
}
```

**Event Handler**:
```typescript
export default {
  // Handle R2 notifications
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Poll for new R2 objects or use R2 event notifications
  },

  // Manual trigger endpoint
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.url.endsWith('/process')) {
      // Manually trigger processing for specific documents
    }
    if (request.url.endsWith('/status')) {
      // Query processing job status
    }
  },

  // Queue consumer for processing tasks
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    for (const message of batch.messages) {
      await processDocument(message.body, env);
    }
  }
}
```

**Processing Pipeline**:
```typescript
async function processDocument(r2Key: string, env: Env) {
  // 1. Create processing job record
  const jobId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO processing_jobs (id, r2_key, status) VALUES (?, ?, ?)'
  ).bind(jobId, r2Key, 'processing').run();

  try {
    // 2. Download from R2
    const object = await env.DOCUMENTS_BUCKET.get(r2Key);
    const content = await object.text();

    // 3. Parse metadata
    const metadata = parseMetadata(r2Key, content);

    // 4. Generate document tags
    const documentTags = await generateTags(content, env.OPENAI_API_KEY);

    // 5. Chunk content
    const chunks = chunkMarkdown(content);

    // 6. Generate embeddings (batched)
    const embeddings = await generateEmbeddings(chunks, env.OPENAI_API_KEY);

    // 7. Generate chunk tags (batched)
    const chunkTags = await batchGenerateTags(chunks, env.OPENAI_API_KEY);

    // 8. Store in D1 + Vectorize
    await storeDocument(metadata, documentTags, chunks, embeddings, chunkTags, env);

    // 9. Update job status
    await env.DB.prepare(
      'UPDATE processing_jobs SET status = ?, completed_at = datetime("now") WHERE id = ?'
    ).bind('completed', jobId).run();

  } catch (error) {
    // Update job with error
    await env.DB.prepare(
      'UPDATE processing_jobs SET status = ?, error_message = ? WHERE id = ?'
    ).bind('failed', error.message, jobId).run();
  }
}
```

---

#### OpenAI Batch Processing Strategy

**Challenge**: OpenAI API has rate limits and can be expensive for large-scale processing.

**Solution**: Use OpenAI's Batch API for cost-effective, asynchronous processing.

---

##### Option 1: Real-Time Processing (Current Approach)

**Use Case**: Small datasets, immediate feedback required

**Pros**:
- Immediate results
- Simple error handling
- Real-time status updates

**Cons**:
- Rate limits (~3,500 TPM for embeddings)
- Higher cost (no batch discount)
- Can fail if quota exhausted

**Implementation**:
```typescript
// Synchronous embedding generation
async function generateEmbeddings(chunks: string[], apiKey: string): Promise<number[][]> {
  const openai = new OpenAI({ apiKey });

  // Batch in groups of 100 (API limit)
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch
    });
    embeddings.push(...response.data.map(d => d.embedding));
  }

  return embeddings;
}
```

**Cost**: $0.02 per 1M tokens

---

##### Option 2: OpenAI Batch API (Recommended for Large Processing)

**Use Case**: Bulk processing, cost optimization, non-urgent updates

**Pros**:
- **50% cost reduction** ($0.01 per 1M tokens)
- No rate limits for batch jobs
- Can process thousands of chunks overnight
- Automatic retry on failures

**Cons**:
- 24-hour processing time (typically faster)
- More complex implementation
- Requires polling for completion
- Not suitable for real-time needs

**Implementation**:

```typescript
// 1. Create batch job with JSONL file
async function createBatchEmbeddingJob(chunks: string[], apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey });

  // Create JSONL request file
  const requests = chunks.map((chunk, index) => ({
    custom_id: `chunk-${index}`,
    method: 'POST',
    url: '/v1/embeddings',
    body: {
      model: 'text-embedding-3-small',
      input: chunk
    }
  }));

  const jsonl = requests.map(r => JSON.stringify(r)).join('\n');

  // Upload to OpenAI
  const file = await openai.files.create({
    file: new Blob([jsonl], { type: 'application/jsonl' }),
    purpose: 'batch'
  });

  // Create batch job
  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/embeddings',
    completion_window: '24h'
  });

  return batch.id;
}

// 2. Poll for batch completion (in separate worker or cron)
async function checkBatchStatus(batchId: string, apiKey: string) {
  const openai = new OpenAI({ apiKey });
  const batch = await openai.batches.retrieve(batchId);

  if (batch.status === 'completed') {
    // Download results
    const outputFile = await openai.files.content(batch.output_file_id);
    const results = parseJSONL(await outputFile.text());

    // Process results
    return results.map(r => r.response.body.data[0].embedding);
  } else if (batch.status === 'failed') {
    throw new Error(`Batch failed: ${batch.errors}`);
  }

  return null; // Still processing
}

// 3. Store batch job tracking in D1
CREATE TABLE batch_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openai_batch_id TEXT NOT NULL UNIQUE,
  processing_job_id INTEGER NOT NULL,
  type TEXT NOT NULL,  -- 'embeddings' or 'tags'
  status TEXT NOT NULL,  -- 'pending', 'completed', 'failed'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (processing_job_id) REFERENCES processing_jobs(id)
);
```

**Batch Processing Flow**:
```
1. Document uploaded to R2
2. Worker chunks document
3. Submit embeddings batch to OpenAI → returns batch_id
4. Store batch_id in D1 with status='pending'
5. Cron worker polls batch status every 5 minutes
6. When complete, download results and store in Vectorize
7. Update processing_job status to 'completed'
```

**Cost Comparison** (10,000 chunks):
- Real-time: $0.20
- Batch API: $0.10 (50% savings)

---

##### Option 3: Hybrid Approach (Recommended)

**Strategy**: Use real-time for small updates, batch for bulk processing

```typescript
async function processDocument(r2Key: string, env: Env, useBatch: boolean = false) {
  // ... existing code ...

  const chunks = chunkMarkdown(content);

  if (useBatch && chunks.length > 50) {
    // Use batch API for large documents
    const batchId = await createBatchEmbeddingJob(chunks, env.OPENAI_API_KEY);

    // Store batch job reference
    await env.DB.prepare(
      'INSERT INTO batch_jobs (openai_batch_id, processing_job_id, type, status) VALUES (?, ?, ?, ?)'
    ).bind(batchId, jobId, 'embeddings', 'pending').run();

    // Update job status to 'batch_pending'
    await env.DB.prepare(
      'UPDATE processing_jobs SET status = ? WHERE id = ?'
    ).bind('batch_pending', jobId).run();

    // Processing will complete asynchronously via cron
  } else {
    // Use real-time API for small documents
    const embeddings = await generateEmbeddings(chunks, env.OPENAI_API_KEY);
    const chunkTags = await batchGenerateTags(chunks, env.OPENAI_API_KEY);
    await storeDocument(metadata, documentTags, chunks, embeddings, chunkTags, env);

    await env.DB.prepare(
      'UPDATE processing_jobs SET status = ?, completed_at = datetime("now") WHERE id = ?'
    ).bind('completed', jobId).run();
  }
}

// Cron worker to process batch results
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Check pending batch jobs
    const pendingBatches = await env.DB.prepare(
      'SELECT * FROM batch_jobs WHERE status = ? LIMIT 10'
    ).bind('pending').all();

    for (const batch of pendingBatches.results) {
      const results = await checkBatchStatus(batch.openai_batch_id, env.OPENAI_API_KEY);

      if (results) {
        // Store embeddings in Vectorize
        await storeEmbeddings(batch.processing_job_id, results, env);

        // Update batch status
        await env.DB.prepare(
          'UPDATE batch_jobs SET status = ?, completed_at = datetime("now") WHERE id = ?'
        ).bind('completed', batch.id).run();

        // Update processing job
        await env.DB.prepare(
          'UPDATE processing_jobs SET status = ?, completed_at = datetime("now") WHERE id = ?'
        ).bind('completed', batch.processing_job_id).run();
      }
    }
  }
};
```

**Wrangler Cron Configuration**:
```jsonc
{
  "triggers": {
    "crons": ["*/5 * * * *"]  // Check every 5 minutes
  }
}
```

**Decision Matrix**:

| Document Size | Chunks | Strategy | Latency | Cost |
|--------------|--------|----------|---------|------|
| Small | < 50 | Real-time | ~5s | $0.01 |
| Medium | 50-200 | Real-time | ~20s | $0.04 |
| Large | 200+ | Batch API | ~2-24h | $0.02 |
| Bulk migration | 1000s | Batch API | ~24h | $0.10 |

**Recommended**: Use **Hybrid Approach** with threshold at 50 chunks

**API Endpoints**:
```
POST /v1/documents/process
{
  "r2_key": "experiments/webforms.json"
}
Response: { "job_id": "uuid", "status": "pending" }

GET /v1/documents/status/:job_id
Response: {
  "job_id": "uuid",
  "status": "completed" | "processing" | "failed",
  "started_at": "ISO date",
  "completed_at": "ISO date",
  "error_message": "..."
}

GET /v1/documents/jobs?status=pending&limit=50
Response: {
  "jobs": [...],
  "total": 123
}

POST /v1/documents/reprocess
{
  "document_id": "uuid"
}
Response: { "job_id": "uuid" }
```

---

### Component 3: Updated Query Service

**Location**: `apps/service/src/` (modify existing files)

**Changes Required**:

#### 3.1 Replace Supabase Client with Cloudflare Bindings

**Files to modify**:
- `src/chat.ts`
- `src/getContext.ts`
- `src/utils/query.ts`

**New binding interface**:
```typescript
// worker-configuration.d.ts (add to existing)
interface CloudflareBindings {
  // Existing
  OPENAI_API_KEY: string;

  // New bindings
  DB: D1Database;
  DOCUMENTS_BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;
}
```

#### 3.2 Data Access Layer for Cloudflare

**New files**:
- `src/data-access/d1-data-access.ts`
- `src/data-access/vectorize-client.ts`
- `src/data-access/types.ts`

**Interface**:
```typescript
// types.ts
export interface Company {
  id: string;
  name: string;
  start_time: string;
  end_time: string | null;
  title: string;
  description: string;
}

export interface Document {
  id: string;
  content_hash: string;
  company_id: string;
  project: string;
  tags: string[];
  r2_key: string;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  content: string;
  document_id: string;
  type: string;
  tags: string[];
  vectorize_id: string;
  created_at: string;
  updated_at: string;
}

// d1-data-access.ts
export class D1DataAccess {
  constructor(private db: D1Database) {}

  async getDocumentById(id: string): Promise<Document | null> {
    const result = await this.db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;

    return {
      ...result,
      tags: JSON.parse(result.tags as string)
    } as Document;
  }

  async getChunksByDocumentId(documentId: string): Promise<Chunk[]> {
    const result = await this.db
      .prepare('SELECT * FROM chunks WHERE document_id = ?')
      .bind(documentId)
      .all();

    return result.results.map(row => ({
      ...row,
      tags: JSON.parse(row.tags as string)
    })) as Chunk[];
  }

  async getChunksByTags(tags: string[], limit: number): Promise<Chunk[]> {
    // Note: D1 doesn't have native JSON array search like PostgreSQL
    // Use SQL JSON functions or fetch and filter in-memory
    // For better performance, consider using Vectorize metadata filtering

    const result = await this.db
      .prepare('SELECT * FROM chunks LIMIT ?')
      .bind(limit * 3) // Over-fetch for filtering
      .all();

    const chunks = result.results.map(row => ({
      ...row,
      tags: JSON.parse(row.tags as string)
    })) as Chunk[];

    // Filter and score by tag overlap
    return chunks
      .map(chunk => ({
        chunk,
        matchCount: tags.filter(tag => chunk.tags.includes(tag)).length
      }))
      .filter(item => item.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, limit)
      .map(item => item.chunk);
  }
}

// vectorize-client.ts
export class VectorizeClient {
  constructor(private index: VectorizeIndex) {}

  async query(embedding: number[], topK: number, filter?: Record<string, any>) {
    const results = await this.index.query(embedding, {
      topK,
      returnMetadata: 'all',
      filter
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
      vectorId: match.vectorId
    }));
  }

  async insertVectors(vectors: Array<{ id: string; values: number[]; metadata: any }>) {
    return await this.index.insert(vectors);
  }

  async deleteByIds(ids: string[]) {
    return await this.index.deleteByIds(ids);
  }
}
```

#### 3.3 Update Context Retrieval

**Modify `src/getContext.ts`**:
```typescript
export const getContext = async (
  embedding: readonly number[],
  tags: readonly string[],
  env: CloudflareBindings
) => {
  const d1Access = new D1DataAccess(env.DB);
  const vectorizeClient = new VectorizeClient(env.VECTORIZE);

  // Hybrid search: vector similarity + tag matching
  const [vectorResults, tagChunks] = await Promise.all([
    vectorizeClient.query(Array.from(embedding), EMBEDDING_MATCH_COUNT),
    d1Access.getChunksByTags(Array.from(tags), TAG_MATCH_COUNT)
  ]);

  // Merge and rank results
  const chunkMap: Record<string, { content: string; document_id: string }> = {};
  const chunksPoints: Record<string, number> = {};
  const documentPoints: Record<string, number> = {};

  // Process vector results
  for (const result of vectorResults) {
    const chunkId = result.metadata.chunk_id;
    const chunk = await d1Access.getChunkById(chunkId);
    if (!chunk) continue;

    chunkMap[chunkId] = { content: chunk.content, document_id: chunk.document_id };
    chunksPoints[chunkId] = (chunksPoints[chunkId] || 0) + result.score * EMBEDDING_SCORE_WEIGHT;
    documentPoints[chunk.document_id] = (documentPoints[chunk.document_id] || 0) + result.score * EMBEDDING_SCORE_WEIGHT;
  }

  // Process tag results
  for (const chunk of tagChunks) {
    const matchCount = tags.filter(tag => chunk.tags.includes(tag)).length;
    chunkMap[chunk.id] = { content: chunk.content, document_id: chunk.document_id };
    chunksPoints[chunk.id] = (chunksPoints[chunk.id] || 0) + matchCount;
    documentPoints[chunk.document_id] = (documentPoints[chunk.document_id] || 0) + matchCount;
  }

  // Find top chunk and document
  const topChunkId = Object.keys(chunksPoints).reduce((a, b) =>
    chunksPoints[a] > chunksPoints[b] ? a : b
  );
  const topDocumentId = Object.keys(documentPoints).reduce((a, b) =>
    documentPoints[a] > documentPoints[b] ? a : b
  );

  const topChunks = [chunkMap[topChunkId].content];

  // Fetch full document from R2 if needed
  let topDocumentContent: string | null = null;
  if (topDocumentId) {
    const doc = await d1Access.getDocumentById(topDocumentId);
    if (doc) {
      const r2Object = await env.DOCUMENTS_BUCKET.get(doc.r2_key);
      topDocumentContent = await r2Object?.text() ?? null;
    }
  }

  return { topChunks, topDocumentContent };
};
```

---

### Component 4: Shared Package

**Location**: `packages/shared/` (new package)

**Purpose**: Share business logic, utilities, and configurations across all applications

**Modules**:

#### 4.1 Prompts & Configuration (`src/prompts.ts`, `src/constants.ts`)
- **Prompts**: Type-safe exports of `defineTags`, `preprocessQuestion`, `answerQuestion`
- **Constants**: `MODEL`, `CHUNK_MAX_TOKENS`, `INPUT_MAX_TOKENS`, embedding dimensions
- **Types**: Shared TypeScript interfaces

```typescript
// packages/shared/src/prompts.ts
import prompts from '../data/prompts.json';

export const defineTagsPrompt = prompts.defineTags;
export const preprocessQuestionPrompt = prompts.preprocessQuestion;
export const answerQuestionPrompt = prompts.answerQuestion;

// Type-safe access
export type PromptConfig = typeof prompts;
```

#### 4.2 Chunking Logic (`src/chunking.ts`)
- Port `scripts/chunk.py` to TypeScript
- Markdown header splitting
- Sentence-based sub-chunking
- Token counting with `tiktoken-js`

```typescript
export function chunkMarkdown(
  markdown: string,
  maxTokens: number = CHUNK_MAX_TOKENS
): string[];

export function buildChunkContextHeader(
  metadata: Record<string, string>,
  part?: number
): string;
```

#### 4.3 Embedding Utilities (`src/embedding.ts`)
- OpenAI embeddings wrapper
- Batch support (100 per request)
- Error handling and retries
- Optional Workers AI support

```typescript
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]>;

export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string
): Promise<number[][]>;
```

#### 4.4 Tag Generation (`src/tags.ts`)
- Port `scripts/generate_tags.py` to TypeScript
- Single tag generation
- Batch tag generation with token awareness
- Tag sanitization (lowercase, snake_case)

```typescript
export async function generateTags(
  content: string,
  apiKey: string
): Promise<string[]>;

export async function batchGenerateTags(
  contents: string[],
  apiKey: string
): Promise<string[][]>;

export function sanitizeTags(rawTags: unknown[]): string[];
```

#### 4.5 Content Hashing (`src/hashing.ts`)
- SHA-256 hash generation
- Content + tags hashing for deduplication

```typescript
export function computeContentHash(
  content: string,
  tags: string[]
): string;
```

**Benefits**:
- **Code reuse**: Single implementation across R2 sync, processor, and service
- **Type safety**: TypeScript types for all shared logic
- **Consistency**: Same chunking/tagging logic everywhere
- **Testing**: Test once, use everywhere
- **Versioning**: Prompts and logic versioned with code
- **No R2 duplication**: Business logic stays in code, not uploaded to R2

---

## Implementation Plan

### Phase 1: Infrastructure Setup (Week 1)

#### Tasks:
1. **Create Cloudflare resources**
   - [ ] Create R2 bucket: `portfolio-documents`
   - [ ] Create D1 database: `portfolio-db`
   - [ ] Create Vectorize index: `portfolio-embeddings`
   - [ ] Set up Queue: `document-processing`

2. **Initialize D1 schema**
   - [ ] Write migration script: `migrations/0001_init_schema.sql`
   - [ ] Apply migration: `wrangler d1 migrations apply portfolio-db`
   - [ ] Verify tables created

3. **Configure Wrangler**
   - [ ] Update `apps/service/wrangler.jsonc` with new bindings
   - [ ] Create `apps/document-processor/wrangler.jsonc`
   - [ ] Set up secrets: `OPENAI_API_KEY`

4. **Set up development environment**
   - [ ] Install dependencies
   - [ ] Configure local D1 for testing
   - [ ] Set up Miniflare for local development

#### Deliverables:
- Working Cloudflare resources
- D1 schema initialized
- Wrangler configurations complete

---

### Phase 2: R2 Sync Client (Week 2)

#### Tasks:
1. **Create sync client structure**
   - [ ] New package: `apps/r2-sync/`
   - [ ] Package.json with dependencies
   - [ ] TypeScript configuration

2. **Implement core functionality**
   - [ ] R2 client wrapper using Wrangler API
   - [ ] Local file scanner
   - [ ] Diff computation (hash-based)
   - [ ] Upload/delete operations

3. **Build CLI interface**
   - [ ] Command parsing with `commander`
   - [ ] Progress reporting with `ora` or `chalk`
   - [ ] Dry-run mode
   - [ ] Interactive confirmations

4. **Testing**
   - [ ] Unit tests for diff logic
   - [ ] Integration tests with local R2 (Miniflare)
   - [ ] Manual testing with staging bucket

5. **Documentation**
   - [ ] Usage guide
   - [ ] Troubleshooting tips

#### Deliverables:
- Functional R2 sync CLI tool
- Tested with local and staging environments
- Documentation complete

---

### Phase 3: Shared Package (Week 3)

#### Tasks:
1. **Create package structure**
   - [ ] New package: `packages/shared/`
   - [ ] Move `documents/prompts.json` to `packages/shared/data/prompts.json`
   - [ ] Export organization with proper TypeScript types
   - [ ] TypeScript compilation setup

2. **Implement prompts & configuration**
   - [ ] Type-safe prompt exports from JSON
   - [ ] Constants module (`MODEL`, `CHUNK_MAX_TOKENS`, etc.)
   - [ ] Shared TypeScript types

3. **Port chunking logic**
   - [ ] Convert `chunk.py` to TypeScript
   - [ ] Support markdown header splitting with langchain
   - [ ] Sentence-based sub-chunking with `natural` or `compromise`
   - [ ] Token counting with `tiktoken-js`

4. **Port embedding logic**
   - [ ] OpenAI embeddings wrapper
   - [ ] Batch support (100 per request)
   - [ ] Error handling and retries
   - [ ] Optional Workers AI support

5. **Port tag generation**
   - [ ] Convert `generate_tags.py` to TypeScript
   - [ ] Single tag generation
   - [ ] Batch tag generation with token awareness
   - [ ] Tag sanitization function

6. **Add content hashing**
   - [ ] SHA-256 hash function using Web Crypto API
   - [ ] Content + tags hashing for deduplication

7. **Testing**
   - [ ] Unit tests for all modules
   - [ ] Integration tests with OpenAI (mocked)
   - [ ] Verify chunking consistency with Python output
   - [ ] Test prompt loading and type safety

#### Deliverables:
- `@portfolio/shared` package
- 100% test coverage for core functions
- Documentation with usage examples
- Migration guide for moving `prompts.json`

---

### Phase 4: Document Processing Worker (Week 4-5)

#### Tasks:
1. **Create worker structure**
   - [ ] New worker: `apps/document-processor/`
   - [ ] Bindings configuration
   - [ ] TypeScript setup

2. **Implement event handlers**
   - [ ] Queue consumer for processing tasks
   - [ ] HTTP endpoints for manual triggers
   - [ ] Status query endpoints

3. **Build processing pipeline**
   - [ ] R2 download logic
   - [ ] Metadata parsing
   - [ ] Integration with shared utilities
   - [ ] OpenAI API calls (embeddings + tags)
   - [ ] D1 data storage
   - [ ] Vectorize insertion
   - [ ] Error handling and rollback

4. **Job tracking system**
   - [ ] Processing job creation
   - [ ] Status updates
   - [ ] Error logging
   - [ ] Query interface

5. **Testing**
   - [ ] Unit tests for processing logic
   - [ ] Integration tests with mocked OpenAI
   - [ ] End-to-end tests with local stack
   - [ ] Load testing (concurrent processing)

6. **Monitoring**
   - [ ] Logging with structured output
   - [ ] Metrics for processing time
   - [ ] Error alerting

#### Deliverables:
- Functional document processing worker
- Job tracking API
- Comprehensive test coverage
- Monitoring setup

---

### Phase 5: Update Query Service (Week 6)

#### Tasks:
1. **Create data access layer**
   - [ ] D1DataAccess class
   - [ ] VectorizeClient class
   - [ ] R2Client wrapper
   - [ ] Type definitions

2. **Update context retrieval**
   - [ ] Replace Supabase calls in `getContext.ts`
   - [ ] Implement hybrid search with D1 + Vectorize
   - [ ] Add R2 document fetching

3. **Update query utilities**
   - [ ] Modify `utils/query.ts` for D1
   - [ ] Remove Supabase RPC function calls
   - [ ] Implement tag matching in TypeScript

4. **Update chat endpoint**
   - [ ] Pass CloudflareBindings instead of Supabase client
   - [ ] Update error handling
   - [ ] Maintain backward compatibility in responses

5. **Testing**
   - [ ] Update existing tests
   - [ ] Add tests for new data access layer
   - [ ] Integration tests with local stack
   - [ ] Performance comparison with Supabase version

6. **Cleanup**
   - [ ] Remove Supabase dependencies from package.json
   - [ ] Remove unused imports
   - [ ] Update documentation

#### Deliverables:
- Updated query service using Cloudflare bindings
- All tests passing
- Performance benchmarks

---

### Phase 6: Data Migration (Week 7)

#### Tasks:
1. **Export from Supabase**
   - [ ] Script to export companies
   - [ ] Script to export documents (with full content)
   - [ ] Script to export chunks (without embeddings)
   - [ ] Save to JSON files

2. **Prepare for import**
   - [ ] Convert data formats (UUIDs, dates, arrays)
   - [ ] Upload documents to R2
   - [ ] Generate R2 keys mapping

3. **Import to Cloudflare**
   - [ ] Import companies to D1
   - [ ] Import documents metadata to D1
   - [ ] Trigger processing for each document (regenerate chunks + embeddings)

4. **Verification**
   - [ ] Compare record counts
   - [ ] Spot-check data accuracy
   - [ ] Test queries against migrated data

5. **Rollback plan**
   - [ ] Keep Supabase data for 30 days
   - [ ] Document rollback procedure

#### Deliverables:
- Complete data migrated to Cloudflare
- Verification report
- Rollback procedure documented

---

### Phase 7: Integration & End-to-End Testing (Week 8)

#### Tasks:
1. **End-to-end workflows**
   - [ ] Sync documents with R2 sync client
   - [ ] Verify processing jobs complete
   - [ ] Test query service with migrated data
   - [ ] Verify answer quality matches Supabase version

2. **Performance testing**
   - [ ] Query latency benchmarks
   - [ ] Processing throughput tests
   - [ ] Vectorize query performance
   - [ ] D1 query optimization

3. **Error handling**
   - [ ] Test failure scenarios (OpenAI timeout, R2 errors, D1 errors)
   - [ ] Verify retry logic
   - [ ] Check error reporting

4. **Security review**
   - [ ] Verify API authentication
   - [ ] Check R2 bucket permissions
   - [ ] Review D1 security

5. **Documentation**
   - [ ] Update README
   - [ ] Architecture diagrams
   - [ ] Deployment guide
   - [ ] Troubleshooting guide

#### Deliverables:
- Complete end-to-end tests passing
- Performance report
- Security review complete
- Documentation updated

---

### Phase 8: Deployment & Monitoring (Week 9)

#### Tasks:
1. **Staging deployment**
   - [ ] Deploy document processor to staging
   - [ ] Deploy query service to staging
   - [ ] Run smoke tests

2. **Production deployment**
   - [ ] Deploy infrastructure (R2, D1, Vectorize)
   - [ ] Deploy document processor worker
   - [ ] Deploy query service worker
   - [ ] Run production smoke tests

3. **Set up monitoring**
   - [ ] Configure Cloudflare Analytics
   - [ ] Set up custom metrics
   - [ ] Configure alerts for errors
   - [ ] Set up logging aggregation

4. **Post-deployment validation**
   - [ ] Monitor query latency
   - [ ] Monitor error rates
   - [ ] Verify answer quality
   - [ ] User acceptance testing

5. **Cleanup**
   - [ ] Archive Python scripts
   - [ ] Remove Supabase references from codebase
   - [ ] Update CI/CD pipelines

#### Deliverables:
- Production deployment complete
- Monitoring dashboards live
- All systems operational
- Old infrastructure decommissioned

---

## Risk Assessment

### High Risks

#### 1. D1 SQL Limitations
**Risk**: D1 doesn't support PostgreSQL-specific features (arrays, custom types, RPC functions)

**Mitigation**:
- Store arrays as JSON text
- Implement tag matching in TypeScript
- Use Vectorize metadata for filtering
- Test query performance early

**Impact**: Medium
**Likelihood**: High

---

#### 2. Vectorize Beta Limitations
**Risk**: Vectorize is in beta and may have stability or feature gaps

**Mitigation**:
- Test thoroughly in staging
- Implement retry logic
- Have fallback to Supabase during transition
- Monitor Cloudflare status page

**Impact**: High
**Likelihood**: Medium

---

#### 3. OpenAI API Costs
**Risk**: Processing all documents at once may incur high embedding costs

**Mitigation**:
- Batch processing to spread costs
- Cache embeddings where possible
- Use differential processing (only changed documents)
- Monitor OpenAI usage dashboard

**Impact**: Medium
**Likelihood**: Medium

---

#### 4. Data Loss During Migration
**Risk**: Errors during migration could corrupt or lose data

**Mitigation**:
- Keep Supabase data intact during migration
- Implement rollback procedure
- Verify data after each migration step
- Use transactions where possible

**Impact**: High
**Likelihood**: Low

---

### Medium Risks

#### 5. Query Performance Degradation
**Risk**: Cloudflare stack may be slower than Supabase

**Mitigation**:
- Benchmark early and often
- Optimize D1 queries (indexes, prepared statements)
- Use Vectorize metadata filtering
- Consider caching layer if needed

**Impact**: Medium
**Likelihood**: Medium

---

#### 6. Development Complexity
**Risk**: Building event-driven architecture is more complex than Python scripts

**Mitigation**:
- Break into small, testable modules
- Extensive testing at each phase
- Reuse existing patterns from current codebase
- Get early feedback from stakeholders

**Impact**: Low
**Likelihood**: High

---

### Low Risks

#### 7. R2 Event Notification Delays
**Risk**: R2 event notifications may have latency

**Mitigation**:
- Implement polling as fallback
- Add manual trigger API
- Set expectations for processing time

**Impact**: Low
**Likelihood**: Medium

---

## Testing Strategy

### Unit Tests

**Coverage**:
- Chunking logic (markdown parsing, sentence splitting)
- Embedding utilities (batch processing, error handling)
- Tag generation (single and batch)
- D1 data access layer (CRUD operations)
- Vectorize client (query, insert, delete)

**Tools**:
- Vitest
- `@cloudflare/vitest-pool-workers` for D1/R2 mocking

**Target**: 80% code coverage

---

### Integration Tests

**Coverage**:
- R2 sync client with local bucket
- Document processor with mocked OpenAI
- Query service with local D1 + Vectorize
- End-to-end document flow

**Tools**:
- Vitest
- Miniflare for local Cloudflare environment
- OpenAI mocks

**Target**: All critical paths covered

---

### Performance Tests

**Metrics**:
- Query latency (p50, p95, p99)
- Processing throughput (documents/minute)
- Vectorize query time
- D1 query time

**Tools**:
- k6 or Artillery for load testing
- Cloudflare Analytics
- Custom timing instrumentation

**Baseline**: Match or improve on Supabase performance

---

### End-to-End Tests

**Scenarios**:
1. Sync new document → Process → Query → Verify answer
2. Update existing document → Reprocess → Query → Verify update
3. Delete document → Verify cleanup in D1/Vectorize
4. Multiple concurrent queries
5. Large batch processing

**Tools**:
- Playwright or Cypress for automated flows
- Manual testing for answer quality

---

## Deployment Strategy

### Environment Setup

#### Development
- Local Miniflare for D1, R2, Vectorize
- Wrangler dev mode for workers
- OpenAI API key in `.dev.vars`

#### Staging
- Cloudflare staging resources
- Separate R2 bucket, D1 database, Vectorize index
- `wrangler deploy --env staging`

#### Production
- Production Cloudflare resources
- `wrangler deploy --env production`

---

### Rollout Plan

#### Phase 1: Dual-Run (Week 9)
- Keep Supabase operational
- Deploy Cloudflare stack alongside
- Route 10% of traffic to new stack
- Compare results and performance

#### Phase 2: Gradual Migration (Week 10)
- Increase traffic to 50%
- Monitor error rates
- Fix issues as they arise
- Sync data between systems

#### Phase 3: Full Migration (Week 11)
- Route 100% traffic to Cloudflare
- Keep Supabase as read-only backup
- Monitor for 1 week

#### Phase 4: Decommission (Week 12)
- Archive Supabase data
- Cancel Supabase subscription
- Clean up old code references

---

### Rollback Procedure

If critical issues arise:

1. **Immediate**: Route traffic back to Supabase (update DNS/routing)
2. **Short-term**: Fix issues in Cloudflare stack, redeploy
3. **Long-term**: If unfixable, stay on Supabase and reassess

**Rollback triggers**:
- Error rate > 5%
- Query latency > 2x baseline
- Data corruption detected
- OpenAI quota exhausted

---

## Appendix

### A. File Structure (Post-Migration)

```
port-db/
├── apps/
│   ├── service/                 # Updated query service
│   │   ├── src/
│   │   │   ├── data-access/    # NEW: D1/Vectorize clients
│   │   │   ├── chat.ts         # MODIFIED: use Cloudflare bindings
│   │   │   ├── getContext.ts   # MODIFIED: hybrid search with D1/Vectorize
│   │   │   └── ...
│   │   └── wrangler.jsonc      # MODIFIED: add D1/R2/Vectorize bindings
│   ├── document-processor/      # NEW: Event-driven processor
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── processing.ts
│   │   │   └── ...
│   │   └── wrangler.jsonc
│   └── r2-sync/                 # NEW: CLI tool for R2 sync
│       ├── src/
│       │   ├── cli.ts
│       │   ├── sync.ts
│       │   └── ...
│       └── package.json
├── packages/
│   └── shared/                   # NEW: Shared business logic
│       ├── src/
│       │   ├── prompts.ts        # Type-safe prompt exports
│       │   ├── constants.ts      # Shared constants
│       │   ├── types.ts          # Shared TypeScript types
│       │   ├── chunking.ts       # Markdown chunking logic
│       │   ├── embedding.ts      # OpenAI embedding utilities
│       │   ├── tags.ts           # Tag generation and sanitization
│       │   └── hashing.ts        # Content hashing
│       ├── data/
│       │   └── prompts.json      # Moved from documents/
│       └── package.json
├── cloudflare/                   # NEW: Infrastructure configs
│   ├── d1/
│   │   └── migrations/
│   │       └── 0001_init_schema.sql
│   └── vectorize/
│       └── index-config.json
├── scripts/                      # DEPRECATED: Keep for reference
│   └── [Python scripts archived]
├── supabase/                     # DEPRECATED: Keep for rollback
│   └── [Supabase configs archived]
└── docs/
    └── cloudflare-migration-plan.md
```

---

### B. Key Differences: Supabase vs. Cloudflare

| Feature | Supabase | Cloudflare |
|---------|----------|------------|
| **Database** | PostgreSQL | D1 (SQLite) |
| **Arrays** | Native support | JSON as TEXT |
| **Vector Search** | pgvector extension | Vectorize (separate service) |
| **RPC Functions** | Custom PL/pgSQL | Implement in Worker |
| **Storage** | Supabase Storage | R2 |
| **Indexing** | GIN, HNSW | D1 indexes + Vectorize |
| **Tag Search** | Array overlap operator | JSON parsing + filtering |
| **Embedding Storage** | In chunks table | In Vectorize |

---

### C. Cost Comparison (Estimated)

#### Supabase (Current)
- Database: $25/month (Pro plan)
- Storage: ~$0.10/GB
- Egress: $0.09/GB
- **Estimated Total**: ~$30-40/month

#### Cloudflare (Target)
- D1: $5/month (10M reads, 10M writes included)
- R2: $0.015/GB storage + $0.36/million Class A operations
- Vectorize: $0.04/1M dimensions stored + $0.001/1000 queries
- Workers: $5/month (10M requests included)
- **Estimated Total**: ~$15-20/month

**Savings**: ~40-50%

---

### D. Performance Targets

| Metric | Supabase (Baseline) | Cloudflare (Target) |
|--------|---------------------|---------------------|
| Query Latency (p50) | 200ms | ≤ 250ms |
| Query Latency (p95) | 500ms | ≤ 600ms |
| Processing Time/Doc | 30s | ≤ 40s |
| Concurrent Queries | 50/s | ≥ 50/s |
| Availability | 99.9% | ≥ 99.9% |

---

### E. Success Criteria

✅ **Must Have**:
- All data migrated successfully
- Query service returns accurate results
- Performance within 20% of baseline
- Zero data loss
- All tests passing
- Documentation complete

✅ **Should Have**:
- Cost savings achieved
- Improved developer experience
- Better monitoring and observability
- Easier document updates

✅ **Nice to Have**:
- Performance improvements over baseline
- Real-time processing updates
- Automated document discovery
- Version history for documents

---

## Conclusion

This migration plan provides a comprehensive roadmap for transitioning from Supabase to Cloudflare's edge-native stack. The phased approach minimizes risk while ensuring thorough testing and validation at each step.

**Key Success Factors**:
1. Incremental implementation with early testing
2. Comprehensive testing at unit, integration, and E2E levels
3. Data safety with rollback procedures
4. Monitoring and observability from day one
5. Clear communication and documentation

**Timeline**: 12 weeks total (9 weeks implementation + 3 weeks rollout)

**Next Steps**:
1. Review and approve this plan
2. Set up Cloudflare resources (Phase 1)
3. Begin implementation starting with R2 sync client (Phase 2)

---

**Plan prepared by**: Claude Sonnet 4.5
**Date**: November 1, 2025

