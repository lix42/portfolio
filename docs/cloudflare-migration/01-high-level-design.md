# High-Level Design: Cloudflare Stack Migration

**Version**: 1.0
**Last Updated**: November 1, 2025
**Status**: Planning Phase

---

## Executive Summary

This document outlines the high-level architecture for migrating the Portfolio RAG Assistant from a Supabase-based architecture to Cloudflare's edge-native stack.

### Migration Scope

- **Storage**: Supabase Storage → R2 (document storage)
- **Database**: PostgreSQL → D1 (structured data)
- **Vector Search**: pgvector → Cloudflare Vectorize
- **Ingestion**: Python scripts → Durable Objects-based event-driven architecture
- **Query Service**: Supabase client → Cloudflare bindings

### Key Benefits

- **Cost Reduction**: Eliminate Supabase subscription, lower infrastructure costs
- **Performance**: Edge-native architecture with global distribution
- **Scalability**: Serverless auto-scaling without capacity planning
- **Simplicity**: Unified Cloudflare stack, single dashboard
- **Developer Experience**: Type-safe Workers, local development with Wrangler

---

## Current Architecture

### Data Flow

#### Ingestion (Python Scripts - Client-Side)
```
Local Documents → Chunking → OpenAI Embeddings → Tag Generation → Supabase Storage
```

1. Read markdown files from `documents/experiments/`
2. Chunk into context-aware segments (max 800 tokens)
3. Generate OpenAI embeddings (text-embedding-3-small, 1536 dimensions)
4. Extract tags via LLM
5. Upsert to Supabase tables

#### Query (TypeScript Service)
```
User Question → Preprocess → Embed → Hybrid Search → GPT-4 Answer
```

1. Preprocess question with LLM (extract tags)
2. Generate question embedding
3. Hybrid search: vector similarity + tag matching
4. Rank results with weighted scoring
5. Generate answer with GPT-4

### Database Schema (Current)

```sql
-- PostgreSQL with pgvector extension
companies(id, name, start_time, end_time, title, description)
documents(id, content, content_hash, company_id, tags[], project, ...)
chunks(id, content, embedding[1536], tags[], document_id, type, ...)
```

**Features**:
- HNSW index for vector similarity
- GIN indexes for array tag search
- Custom RPC functions for hybrid queries
- Foreign key constraints with CASCADE delete

### Limitations

- **Client-side ingestion**: Manual script execution, no automation
- **No event-driven updates**: Documents must be manually reprocessed
- **Coupling**: Business logic mixed with infrastructure
- **Cost**: Supabase subscription + compute costs
- **Local dev**: Requires Supabase connection

---

## Target Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Portfolio RAG Assistant                      │
│                    (Cloudflare Edge Stack)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼─────┐  ┌──────▼──────┐  ┌───▼───────┐
        │   R2 Sync   │  │  Document   │  │   Query   │
        │   Client    │  │  Processor  │  │  Service  │
        │   (CLI)     │  │   (Worker)  │  │  (Worker) │
        └─────┬───────┘  └──────┬──────┘  └───┬───────┘
              │                 │              │
              │           ┌─────▼──────┐       │
              │           │  Durable   │       │
              │           │  Objects   │       │
              │           └─────┬──────┘       │
              │                 │              │
        ┌─────▼─────────────────▼──────────────▼──────┐
        │         Cloudflare Platform Services         │
        │  ┌──────┐  ┌──────┐  ┌──────────┐  ┌─────┐ │
        │  │  R2  │  │  D1  │  │Vectorize │  │Queue│ │
        │  └──────┘  └──────┘  └──────────┘  └─────┘ │
        └──────────────────────────────────────────────┘
```

### Data Flow

#### Ingestion (Event-Driven)
```
Local Docs → R2 Sync → R2 Event → Queue → Durable Object → D1 + Vectorize
                                              ↓
                                    State Machine Processing:
                                    1. Download & Chunk
                                    2. Generate Embeddings (batched)
                                    3. Generate Tags (batched)
                                    4. Store Results
```

**Key Innovation**: Durable Objects orchestrate multi-step processing, breaking work into small batches that stay within Worker limits.

#### Query (Edge-Native)
```
User Question → Worker → D1 + Vectorize → Context Retrieval → GPT-4 Answer
```

No architectural changes to query flow, just swap Supabase client for Cloudflare bindings.

### Cloudflare Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **R2** | Document storage | Versioning, event notifications, low cost |
| **D1** | Structured data | SQLite-compatible, edge replication |
| **Vectorize** | Vector search | 1536-dim embeddings, metadata filtering |
| **Workers** | Compute | Edge execution, zero cold starts |
| **Durable Objects** | Stateful processing | Strong consistency, automatic persistence |
| **Queues** | Async processing | Guaranteed delivery, batching |

### Database Schema (Target)

```sql
-- D1 (SQLite)
companies(id INTEGER, name, start_time, end_time, title, description)
documents(id INTEGER, content_hash, company_id, tags TEXT, r2_key, ...)
chunks(id INTEGER, content, document_id, tags TEXT, vectorize_id, ...)
```

**Changes**:
- `INTEGER` IDs instead of UUIDs (better D1 performance)
- Tags stored as JSON TEXT (no native array support)
- Chunk content in D1 (not R2) for low latency
- No embeddings in D1 (stored in Vectorize)
- No `processing_jobs` tables (state in Durable Objects)

---

## Key Architectural Decisions

All detailed decisions are embedded in respective design specs. Summary:

### 1. Processing State Storage: Durable Objects
**Problem**: Worker runtime limits (30s CPU, 50 subrequests) block document processing

**Solution**: Use Durable Objects to orchestrate state machine-based processing
- Each step executes in separate Worker invocation
- State automatically persisted between steps
- Strong consistency, automatic retries

**See**: [Document Processor Design](./design/document-processor.md#decision-durable-objects-for-processing-state)

### 2. Chunk Content Storage: D1
**Problem**: Where to store chunk text?

**Solution**: Store in D1 for low-latency retrieval
- Query service needs immediate access
- R2 fetch adds 50-100ms latency
- D1 size limits acceptable for portfolio use case

**See**: [Document Processor Design](./design/document-processor.md#decision-chunk-content-storage)

### 3. ID Type: INTEGER
**Problem**: D1 performance with UUIDs vs integers?

**Solution**: Use INTEGER PRIMARY KEY AUTOINCREMENT
- Better D1 indexing performance
- Simpler joins
- Migration script handles UUID → INTEGER mapping

**See**: [Database Schema](./design/database-schema.md#decision-id-type)

### 4. Embeddings Provider: OpenAI
**Problem**: OpenAI vs Workers AI for embeddings?

**Solution**: Start with OpenAI, consider Workers AI later
- Proven quality with current pipeline
- Workers AI still in beta
- Easy to swap later if needed

**See**: [Document Processor Design](./design/document-processor.md#decision-embeddings-provider)

### 5. Tag Search: Hybrid D1 + Vectorize
**Problem**: How to implement tag-based filtering?

**Solution**: Store tags in both D1 and Vectorize metadata
- Primary path: Vectorize metadata filtering (fast)
- Fallback: D1 JSON queries (flexible)
- Best of both worlds

**See**: [Query Service Design](./design/query-service.md#decision-tag-search-strategy)

### 6. Shared Configuration: packages/shared
**Problem**: Where to store prompts and utilities?

**Solution**: Create packages/shared for business logic
- Reused by both ingestion and query workers
- Version controlled with code
- TypeScript type safety

**See**: [Shared Package Design](./design/shared-package.md#decision-configuration-location)

---

## Success Criteria

### Functional Requirements
- ✅ All existing queries return equivalent results
- ✅ Document ingestion fully automated via R2 events
- ✅ Support for documents of any size (no Worker limits)
- ✅ Self-healing system (reconciliation for missed events)

### Non-Functional Requirements
- ✅ Query latency: < 2s end-to-end (p95)
- ✅ Ingestion latency: < 5 minutes per document
- ✅ Cost reduction: > 50% vs Supabase
- ✅ 99.9% availability

### Quality Gates
- ✅ All tests passing (unit, integration, e2e)
- ✅ Performance benchmarks met
- ✅ Zero data loss during migration
- ✅ Rollback procedure tested

---

## Migration Phases

1. **Infrastructure Setup** (Week 1)
2. **R2 Sync Client** (Week 2)
3. **Shared Package** (Week 3)
4. **Document Processor with Durable Objects** (Weeks 4-6)
5. **Query Service** (Week 7)
6. **Data Migration** (Week 8)
7. **Integration Testing** (Week 9)
8. **Deployment** (Week 10)

**Rollout**: 3 additional weeks (dual-run, gradual traffic shift, full migration)

**Total Timeline**: 13 weeks

**See**: [Implementation Plan](./02-implementation-plan.md) for detailed breakdown

---

## Risk Summary

### Mitigated Risks
- ✅ **Worker Runtime Limits**: Solved by Durable Objects architecture
- ✅ **Data Consistency**: Two-phase commit in DO ensures D1/Vectorize sync
- ✅ **Missed R2 Events**: Reconciliation worker provides self-healing

### Active Risks
- ⚠️ **Vectorize Beta**: Still in beta, may have limitations
- ⚠️ **D1 SQL Differences**: SQLite vs PostgreSQL requires query updates
- ⚠️ **Team Learning Curve**: Durable Objects pattern is new

**See**: [Risk Assessment](./operations/risk-assessment.md) for full analysis

---

## Next Steps

1. Review and approve this high-level design
2. Proceed to detailed design specifications:
   - [Database Schema](./design/database-schema.md)
   - [Document Processor](./design/document-processor.md)
   - [Query Service](./design/query-service.md)
3. Review [Implementation Plan](./02-implementation-plan.md)
4. Begin Phase 1: Infrastructure Setup

---

## References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Vectorize Documentation](https://developers.cloudflare.com/vectorize/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
