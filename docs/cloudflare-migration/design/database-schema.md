# Database Schema Design

**Component**: D1 Database + Vectorize Index
**Dependencies**: None (foundational)

---

## Overview

This document defines the data schema for the Cloudflare migration, including:
- D1 tables for structured data (companies, documents, chunks)
- Vectorize index configuration for vector search
- Migration strategy from Supabase

### Key Changes from Supabase

- PostgreSQL → D1 (SQLite)
- UUIDs → INTEGER IDs
- Array columns → JSON TEXT columns
- pgvector embeddings → Vectorize
- Processing state tables → Durable Objects (not in schema)

---

## Decision: ID Type - INTEGER vs UUID

### Problem Statement

Should we use TEXT for UUIDs or INTEGER for auto-increment IDs?

### Options Considered

#### Option A: TEXT with UUIDs (Current Supabase Approach)

**Pros**:
- **Globally unique**: No coordination needed across systems
- **Security**: Harder to enumerate/guess IDs
- **Compatibility**: Matches Supabase schema (easier migration)
- **Distributed systems**: Works well with multiple writers

**Cons**:
- **Storage overhead**: 36 bytes vs 8 bytes for INTEGER
- **Performance**: String comparisons slower than integer
- **Index size**: Larger indexes = more memory usage
- **D1 optimization**: SQLite is optimized for INTEGER PRIMARY KEY

#### Option B: INTEGER with Auto-increment (Selected)

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

### Decision

**Use INTEGER PRIMARY KEY with AUTOINCREMENT**.

### Rationale

1. **Better performance**: 2-3x faster joins, critical for query service
2. **Simpler schema**: Aligned with SQLite best practices
3. **Single writer pattern**: Document processor is the only writer, no coordination needed
4. **Smaller database**: Reduced storage and index size
5. **Security not critical**: Portfolio data is not sensitive enough to require UUID obfuscation

### Migration Strategy

```sql
-- Create temporary mapping table during migration
CREATE TABLE uuid_id_mapping (
  uuid TEXT PRIMARY KEY,
  new_id INTEGER NOT NULL,
  table_name TEXT NOT NULL
);

-- During migration:
-- 1. Insert old UUID and new INTEGER for each record
-- 2. Use this for foreign key mapping
-- 3. Drop table once migration is complete
```

---

## D1 Schema

### Companies Table

```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_time TEXT NOT NULL,  -- ISO 8601 date string
  end_time TEXT,              -- NULL for current role
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**:
- `start_time` and `end_time` stored as ISO strings (e.g., "2023-01-15")
- D1 datetime functions work with ISO string format
- `UNIQUE` constraint on company name

**Example Data**:
```sql
INSERT INTO companies (name, start_time, end_time, title, description)
VALUES (
  'Acme Corp',
  '2023-01-01',
  '2024-12-31',
  'Senior Software Engineer',
  'Led development of cloud infrastructure'
);
```

### Documents Table

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_hash TEXT NOT NULL UNIQUE,
  company_id INTEGER NOT NULL,
  project TEXT NOT NULL UNIQUE,
  tags TEXT NOT NULL,             -- JSON array as TEXT
  r2_key TEXT NOT NULL,           -- Path in R2 bucket
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
```

**Notes**:
- `content_hash`: SHA-256 hash for change detection
- `project`: Unique identifier (e.g., "experiments/webforms")
- `tags`: JSON string `["tag1", "tag2"]` for document-level tags
- `r2_key`: Full path to original document in R2
- CASCADE delete: Removing company removes all its documents

**Example Data**:
```sql
INSERT INTO documents (content_hash, company_id, project, tags, r2_key)
VALUES (
  'a3f5b2c...',
  1,
  'experiments/webforms',
  '["forms", "validation", "accessibility"]',
  'documents/experiments/webforms.md'
);
```

### Chunks Table

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,          -- Actual chunk text
  document_id INTEGER NOT NULL,
  type TEXT NOT NULL,             -- 'markdown', 'json', etc.
  tags TEXT NOT NULL,             -- JSON array as TEXT
  vectorize_id TEXT NOT NULL UNIQUE,  -- ID in Vectorize index
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

**Notes**:
- `content`: Full chunk text stored in D1 (see [Document Processor - Decision: Chunk Storage](./document-processor.md#decision-chunk-content-storage))
- `tags`: JSON string for chunk-level tags
- `vectorize_id`: Links to embedding in Vectorize (must be unique)
- CASCADE delete: Removing document removes all its chunks

**Example Data**:
```sql
INSERT INTO chunks (content, document_id, type, tags, vectorize_id)
VALUES (
  'Form validation is critical for...',
  1,
  'markdown',
  '["forms", "validation"]',
  'doc-1-chunk-0'
);
```

### Indexes

```sql
-- Chunks indexes
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_tags ON chunks(tags);  -- For JSON queries

-- Documents indexes
CREATE INDEX idx_documents_project ON documents(project);
CREATE INDEX idx_documents_company_id ON documents(company_id);
CREATE INDEX idx_documents_tags ON documents(tags);  -- For JSON queries
```

**Rationale**:
- `document_id`: Foreign key lookups (fetch all chunks for a document)
- `tags`: JSON text search optimization
- `project`: Lookup documents by project name
- `company_id`: Fetch all documents for a company

---

## Note on Processing State

**Processing state is NOT stored in D1.**

The original plan included `processing_jobs` and `batch_jobs` tables. These have been **removed** in favor of [Durable Objects state management](./document-processor.md#decision-durable-objects-for-processing-state).

**Benefits**:
- Clean separation: Permanent data (D1) vs transient state (DO)
- Automatic cleanup: State expires with Durable Object
- Strong consistency: DO provides single-threaded guarantees
- No orphaned records: No cleanup scripts needed

---

## Vectorize Configuration

### Index Setup

```typescript
// wrangler.toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "portfolio-embeddings"
```

### Index Properties

- **Dimensions**: 1536 (OpenAI text-embedding-3-small)
- **Metric**: Cosine similarity
- **Metadata filtering**: Enabled

### Data Structure

```typescript
interface VectorizeRecord {
  id: string;              // chunk.vectorize_id from D1
  values: number[];        // 1536-dimensional embedding
  metadata: {
    document_id: number;   // Links back to D1
    tags: string[];        // Array for filtering
    chunk_index: number;   // Position in document
  };
}
```

### Example Insertion

```typescript
await env.VECTORIZE.upsert([{
  id: 'doc-1-chunk-0',
  values: [0.123, -0.456, ...],  // 1536 floats
  metadata: {
    document_id: 1,
    tags: ['forms', 'validation'],
    chunk_index: 0
  }
}]);
```

### Example Query

```typescript
// Vector similarity search with metadata filter
const results = await env.VECTORIZE.query(
  questionEmbedding,  // 1536-dimensional array
  {
    topK: 50,
    returnMetadata: 'all',
    filter: {
      tags: { $in: ['forms', 'validation'] }  // Filter by tags
    }
  }
);
```

---

## JSON Tag Queries in D1

Since D1 stores tags as JSON TEXT, we use `json_each` for queries:

### Search by Tag

```sql
SELECT c.*
FROM chunks c
WHERE EXISTS (
  SELECT 1
  FROM json_each(c.tags) AS tag
  WHERE tag.value IN ('forms', 'validation')
);
```

### Tag Match Count (for ranking)

```sql
SELECT
  c.*,
  (
    SELECT COUNT(*)
    FROM json_each(c.tags) AS ct
    WHERE ct.value IN (
      SELECT value FROM json_each('["forms","validation"]')
    )
  ) AS match_count
FROM chunks c
ORDER BY match_count DESC;
```

---

## Migration Scripts

### Step 1: Create Schema

```sql
-- Create all tables
CREATE TABLE companies (...);
CREATE TABLE documents (...);
CREATE TABLE chunks (...);

-- Create indexes
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
-- ... other indexes
```

### Step 2: Migrate Companies

```sql
-- Export from Supabase
-- Transform UUIDs to INTEGERs
-- Insert into D1

INSERT INTO uuid_id_mapping (uuid, new_id, table_name)
SELECT id, ROW_NUMBER() OVER (ORDER BY created_at), 'companies'
FROM supabase_companies;

INSERT INTO companies (id, name, start_time, end_time, title, description)
SELECT
  m.new_id,
  s.name,
  s.start_time,
  s.end_time,
  s.title,
  s.description
FROM supabase_companies s
JOIN uuid_id_mapping m ON s.id = m.uuid;
```

### Step 3: Migrate Documents

```sql
INSERT INTO uuid_id_mapping (uuid, new_id, table_name)
SELECT id, ROW_NUMBER() OVER (ORDER BY created_at), 'documents'
FROM supabase_documents;

INSERT INTO documents (id, content_hash, company_id, project, tags, r2_key)
SELECT
  dm.new_id,
  sd.content_hash,
  cm.new_id AS company_id,
  sd.project,
  sd.tags::text,  -- Convert array to JSON string
  sd.r2_key
FROM supabase_documents sd
JOIN uuid_id_mapping dm ON sd.id = dm.uuid
JOIN uuid_id_mapping cm ON sd.company_id = cm.uuid AND cm.table_name = 'companies';
```

### Step 4: Reprocess Chunks

```
Note: Do NOT migrate chunks directly from Supabase.
Instead, trigger reprocessing via Document Processor:
1. Documents are already in R2
2. Document Processor will generate new chunks
3. New INTEGER IDs will be assigned
4. Embeddings regenerated (ensures consistency)
```

### Step 5: Cleanup

```sql
-- Drop mapping table
DROP TABLE uuid_id_mapping;

-- Verify counts
SELECT 'companies' AS table_name, COUNT(*) FROM companies
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'chunks', COUNT(*) FROM chunks;
```

---

## Schema Validation

### Constraints

```sql
-- Check all foreign keys
PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;

-- Verify uniqueness
SELECT content_hash, COUNT(*)
FROM documents
GROUP BY content_hash
HAVING COUNT(*) > 1;

SELECT vectorize_id, COUNT(*)
FROM chunks
GROUP BY vectorize_id
HAVING COUNT(*) > 1;
```

### Data Integrity

```sql
-- Orphaned chunks (should be 0)
SELECT COUNT(*)
FROM chunks c
WHERE NOT EXISTS (
  SELECT 1 FROM documents d WHERE d.id = c.document_id
);

-- Orphaned documents (should be 0)
SELECT COUNT(*)
FROM documents d
WHERE NOT EXISTS (
  SELECT 1 FROM companies c WHERE c.id = d.company_id
);
```

---

## Performance Considerations

### Query Patterns

1. **Fetch chunks by document**: Uses `idx_chunks_document_id`
2. **Search by project**: Uses `idx_documents_project`
3. **Tag filtering**: Uses `idx_chunks_tags` + JSON functions
4. **Join queries**: INTEGER keys optimize join performance

### Estimated Sizes

For a typical portfolio with:
- 5 companies
- 50 documents
- 2,000 chunks

**Storage**:
- Companies: ~1 KB
- Documents: ~25 KB
- Chunks: ~4 MB (assuming 2KB avg chunk size)
- Indexes: ~500 KB
- **Total: ~4.5 MB** (well within D1 limits)

---

## Related Documents

- [High-Level Design](../01-high-level-design.md)
- [Document Processor](./document-processor.md) - Uses this schema
- [Query Service](./query-service.md) - Queries this schema
- [Implementation Plan](../02-implementation-plan.md) - Migration timeline
