# Query Service Design

**Component**: RAG Query Service (apps/service)
**Location**: `apps/service/src/`
**Dependencies**: D1, Vectorize, Shared Package

---

## Overview

The Query Service is the existing TypeScript Hono service that handles RAG (Retrieval-Augmented Generation) queries. This migration updates it to use Cloudflare bindings instead of the Supabase client.

### Changes Required

- Replace Supabase client with Cloudflare bindings (D1, Vectorize)
- Update data access layer
- Implement hybrid search with D1 + Vectorize
- Update tag-based filtering
- Maintain backward-compatible API responses

### What Stays the Same

- Overall query flow and logic
- LLM preprocessing and answer generation
- API endpoints and request/response formats
- Error handling patterns

---

## Decision: Tag Search Strategy

### Problem Statement

How should we implement tag-based chunk search without PostgreSQL array support?

**Requirement**: Find chunks where tags array overlaps with input tags, ranked by match count.

### Options Considered

#### Option A: JSON Functions Only

Store tags as JSON TEXT, use SQLite JSON functions.

**Pros**: Simple schema, native support
**Cons**: No indexes, full table scan, slower for large datasets

#### Option B: Normalized Tags Table

Create separate `chunk_tags` junction table with indexes.

**Pros**: Best performance, indexed lookups
**Cons**: Complex schema, over-engineering for portfolio use case

#### Option C: Vectorize Metadata Only

Store tags only in Vectorize metadata, use metadata filtering.

**Pros**: Fast, unified search
**Cons**: Can't do tag-only queries, less flexible

#### Option D: Hybrid D1 + Vectorize (Selected)

Store tags in both D1 (JSON TEXT) and Vectorize metadata.

**Pros**:
- **Best performance**: Vectorize metadata filtering is fastest
- **Resilient**: D1 fallback if Vectorize fails
- **Flexible**: D1 enables analytics and debugging
- **Simple schema**: No normalized tables
- **Future-proof**: Can optimize either path independently

**Cons**:
- Data duplication (minimal ~1-2KB per chunk)
- Must keep tags synchronized

### Decision

**Use Hybrid Approach**: Store tags in both D1 and Vectorize.

### Rationale

1. **Primary path** uses Vectorize metadata filtering (fast, <30ms)
2. **Fallback path** uses D1 JSON queries (reliable, <100ms)
3. **Debugging** possible via D1 direct queries
4. **Minimal overhead** from tag duplication

### Implementation

```typescript
// Primary: Vectorize metadata filter
async function searchByTags(tags: string[], env: Env): Promise<Chunk[]> {
  try {
    // Try Vectorize first (fastest)
    const vectorResults = await env.VECTORIZE.query(
      zeroVector,  // Use zero vector for tag-only search
      {
        topK: 50,
        returnMetadata: 'all',
        filter: { tags: { $in: tags } }  // Correct operator for array overlap
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
  `).bind(tagsJson, tagsJson, 50).all();

  return result.results.map(row => parseChunk(row));
}
```

### Note on Ranking Differences

The Vectorize path and D1 fallback have different ranking behaviors:
- **Vectorize**: Returns chunks matching ANY input tag (boolean filter)
- **D1 Fallback**: Returns chunks ranked by `match_count` (number of overlapping tags)

This is an acceptable trade-off for performance. If consistent ranking is critical, fetch a larger set from Vectorize and re-rank in the Worker based on match count.

---

## Architecture

### Current Architecture (Supabase)

```
User Question → Preprocess (LLM) → Embed Question → Supabase RPC
                                                      ↓
                                              Hybrid Search
                                         (vector + array tags)
                                                      ↓
                                              Rank Results → GPT-4 Answer
```

### Target Architecture (Cloudflare)

```
User Question → Preprocess (LLM) → Embed Question → Vectorize Query
                                                      ↓
                                              Metadata Filter (tags)
                                                      ↓
                                              D1 Fetch (chunks)
                                                      ↓
                                              Rank Results → GPT-4 Answer
```

**Key Difference**: Hybrid search now spans two systems (Vectorize + D1) instead of one (PostgreSQL).

---

## Data Access Layer

### Interface

```typescript
interface DataAccess {
  // Vector search
  searchByEmbedding(embedding: number[], options: SearchOptions): Promise<Chunk[]>;

  // Tag search
  searchByTags(tags: string[]): Promise<Chunk[]>;

  // Hybrid search
  hybridSearch(embedding: number[], tags: string[], options: SearchOptions): Promise<Chunk[]>;

  // Fetch by IDs
  getChunksByIds(ids: number[]): Promise<Chunk[]>;
  getDocumentById(id: number): Promise<Document | null>;
}
```

### Implementation

```typescript
export class CloudflareDataAccess implements DataAccess {
  constructor(
    private db: D1Database,
    private vectorize: VectorizeIndex,
    private r2: R2Bucket
  ) {}

  async searchByEmbedding(
    embedding: number[],
    options: SearchOptions
  ): Promise<Chunk[]> {
    // Query Vectorize
    const results = await this.vectorize.query(embedding, {
      topK: options.topK || 50,
      returnMetadata: 'all',
      filter: options.tags ? { tags: { $in: options.tags } } : undefined
    });

    // Extract chunk IDs from metadata
    const chunkIds = results.matches.map(m => m.metadata.chunk_id as number);

    // Fetch full chunks from D1
    return this.getChunksByIds(chunkIds);
  }

  async searchByTags(tags: string[]): Promise<Chunk[]> {
    // Hybrid approach: try Vectorize first, fallback to D1
    try {
      return await this.searchByTagsVectorize(tags);
    } catch (error) {
      console.warn('Vectorize failed, using D1 fallback:', error);
      return await this.searchByTagsD1(tags);
    }
  }

  async hybridSearch(
    embedding: number[],
    tags: string[],
    options: SearchOptions
  ): Promise<Chunk[]> {
    // Vectorize handles both vector similarity and tag filtering
    return this.searchByEmbedding(embedding, { ...options, tags });
  }

  async getChunksByIds(ids: number[]): Promise<Chunk[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const result = await this.db.prepare(`
      SELECT c.*, d.project, d.tags as document_tags
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.id IN (${placeholders})
    `).bind(...ids).all();

    return result.results.map(row => this.parseChunk(row));
  }

  private parseChunk(row: any): Chunk {
    return {
      id: row.id,
      content: row.content,
      documentId: row.document_id,
      type: row.type,
      tags: JSON.parse(row.tags),
      vectorizeId: row.vectorize_id,
      project: row.project,
      documentTags: JSON.parse(row.document_tags)
    };
  }
}
```

---

## Context Retrieval

### Current Implementation (Supabase)

```typescript
// src/services/get-context.ts
export async function getContext(
  question: string,
  tags: string[],
  supabase: SupabaseClient
): Promise<Context> {
  // 1. Generate embedding
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question
  });

  // 2. Hybrid search via RPC
  const { data: chunks } = await supabase.rpc('match_chunks_hybrid', {
    query_embedding: embedding.data[0].embedding,
    query_tags: tags,
    match_threshold: 0.7,
    match_count: 50
  });

  // 3. Process and rank results
  return processChunks(chunks);
}
```

### Updated Implementation (Cloudflare)

```typescript
// src/services/get-context.ts
export async function getContext(
  question: string,
  tags: string[],
  env: Env
): Promise<Context> {
  const dataAccess = new CloudflareDataAccess(
    env.DB,
    env.VECTORIZE,
    env.DOCUMENTS_BUCKET
  );

  // 1. Generate embedding
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question
  });

  // 2. Hybrid search via Vectorize + D1
  const chunks = await dataAccess.hybridSearch(
    embedding.data[0].embedding,
    tags,
    {
      topK: 50,
      threshold: 0.7
    }
  );

  // 3. Process and rank results (same logic)
  return processChunks(chunks);
}
```

---

## Changes Required

### File Modifications

#### 1. Update `src/chat.ts`

```typescript
// Before
import { createClient } from '@supabase/supabase-js';

export async function handleChat(request: Request, env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const context = await getContext(question, tags, supabase);
  // ...
}

// After
export async function handleChat(request: Request, env: Env) {
  const context = await getContext(question, tags, env);
  // ...
}
```

#### 2. Create `src/data-access/cloudflare.ts`

New file implementing `CloudflareDataAccess` class (shown above).

#### 3. Update `src/services/get-context.ts`

Replace Supabase client with Cloudflare bindings (shown above).

#### 4. Update `wrangler.jsonc`

```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "portfolio-sql-staging",  // or portfolio-sql-prod
    "database_id": "xxx"
  }],

  "vectorize": [{
    "binding": "VECTORIZE",
    "index_name": "portfolio-embeddings-staging"  // or portfolio-embeddings-prod
  }],

  // Per-environment R2 buckets (1:1:1 mapping: R2 → Queue → Worker)
  "r2_buckets": [{
    "binding": "DOCUMENTS_BUCKET",
    "bucket_name": "portfolio-documents-staging"  // or portfolio-documents-prod
  }]
}
```

#### 5. Update `src/types/env.ts`

```typescript
export interface Env {
  // Remove Supabase
  // SUPABASE_URL: string;
  // SUPABASE_KEY: string;

  // Add Cloudflare bindings
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  DOCUMENTS_BUCKET: R2Bucket;

  // Keep existing
  OPENAI_API_KEY: string;
}
```

#### 6. Remove Dependencies

```bash
# package.json
pnpm remove @supabase/supabase-js
```

---

## Testing Strategy

### Unit Tests

```typescript
// Mock Cloudflare bindings
describe('CloudflareDataAccess', () => {
  let dataAccess: CloudflareDataAccess;
  let mockDB: D1Database;
  let mockVectorize: VectorizeIndex;

  beforeEach(() => {
    mockDB = createMockD1();
    mockVectorize = createMockVectorize();
    dataAccess = new CloudflareDataAccess(mockDB, mockVectorize, mockR2);
  });

  it('should search by embedding', async () => {
    const embedding = new Array(1536).fill(0.1);
    const chunks = await dataAccess.searchByEmbedding(embedding, {});
    expect(chunks).toHaveLength(50);
  });

  it('should fallback to D1 on Vectorize failure', async () => {
    mockVectorize.query = vi.fn().mockRejectedValue(new Error('Vectorize down'));
    const chunks = await dataAccess.searchByTags(['forms']);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// Test with real local bindings
describe('Query Service Integration', () => {
  it('should retrieve context for question', async () => {
    const env = getLocalEnv();  // Wrangler local bindings
    const context = await getContext('How do I validate forms?', ['forms'], env);

    expect(context.chunks).toHaveLength(10);
    expect(context.chunks[0].content).toContain('validation');
  });
});
```

### Performance Benchmarks

```typescript
// Measure query latency
describe('Performance', () => {
  it('should complete hybrid search in <2s', async () => {
    const start = Date.now();
    await getContext(question, tags, env);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);  // p95 target
  });
});
```

---

## Migration Checklist

### Phase 1: Preparation
- [ ] Create CloudflareDataAccess class
- [ ] Write unit tests
- [ ] Update type definitions

### Phase 2: Implementation
- [ ] Update get-context.ts
- [ ] Update chat.ts
- [ ] Remove Supabase client usage
- [ ] Update wrangler.jsonc

### Phase 3: Testing
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Performance benchmarks
- [ ] Manual testing with sample queries

### Phase 4: Deployment
- [ ] Deploy to staging
- [ ] Smoke tests
- [ ] Deploy to production
- [ ] Monitor error rates

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Hybrid Search | < 100ms | Vectorize + D1 fetch |
| Context Retrieval | < 500ms | Including embeddings |
| End-to-End Query | < 2s | Including LLM response |
| Fallback Path | < 200ms | D1 JSON queries |

---

## Rollback Plan

If issues arise:

1. **Instant**: Use feature flag to route traffic back to Supabase
2. **Quick**: Revert Worker deployment
3. **Last resort**: DNS failover to old service

Keep Supabase operational during dual-run phase for easy rollback.

---

## Related Documents

- [High-Level Design](./cloudflare-migration-high-level.md)
- [Database Schema](./database-schema.md)
- [Document Processor](./document-processor.md)
- [Implementation Plan](../02-implementation-plan.md)
