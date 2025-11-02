# Cloudflare Stack Migration Documentation

**Project**: Migrate Portfolio RAG Assistant from Supabase to Cloudflare
**Timeline**: 13 weeks (10 weeks implementation + 3 weeks rollout)
**Status**: Planning Phase
**Last Updated**: November 1, 2025

---

## Overview

This documentation set describes the migration from Supabase (PostgreSQL + pgvector) to Cloudflare's edge-native stack (R2 + D1 + Vectorize + Workers). The migration involves:

- **Storage**: Supabase Storage → R2 (document storage)
- **Database**: PostgreSQL → D1 (structured data)
- **Vector Search**: pgvector → Cloudflare Vectorize
- **Ingestion**: Python scripts → Durable Objects-based event-driven architecture
- **Query Service**: Supabase client → Cloudflare bindings

---

## Documentation Index

### Core Documents

1. **[High-Level Design](./01-high-level-design.md)**
   - Architecture comparison (current vs target)
   - Component diagram and data flow
   - Key architectural decisions summary
   - Success criteria

2. **[Implementation Plan](./02-implementation-plan.md)**
   - 8 phases with timelines and dependencies
   - Links to detailed design specs
   - Testing strategy
   - Total timeline breakdown

### Design Specifications

3. **[Database Schema](./design/database-schema.md)**
   - D1 tables and indexes
   - Vectorize configuration
   - Decision: INTEGER vs UUID for IDs
   - Migration scripts

4. **[Document Processor](./design/document-processor.md)**
   - Durable Objects-based ingestion pipeline
   - Decision: Processing state storage (DO vs D1 vs KV)
   - Decision: Chunk content storage (D1 vs R2)
   - Decision: Embeddings (OpenAI vs Workers AI)
   - State machine implementation
   - Error handling and retry logic

5. **[R2 Sync Client](./design/r2-sync-client.md)**
   - CLI tool for syncing documents folder to R2
   - CI/CD integration
   - Programmatic API

6. **[R2 Reconciliation Worker](./design/r2-reconciliation.md)**
   - Self-healing system for missed R2 events
   - Daily cron job
   - Stuck job detection

7. **[Query Service](./design/query-service.md)**
   - Updated RAG query implementation
   - Decision: Tag search strategy (Hybrid D1 + Vectorize)
   - Data access layer
   - Context retrieval

8. **[Shared Package](./design/shared-package.md)**
   - Decision: Shared configuration location
   - Prompts, chunking, embeddings, tags utilities
   - Package structure

### Operations

9. **[Monitoring & Observability](./operations/monitoring.md)**
   - Durable Objects monitoring
   - Pipeline metrics and KPIs
   - Alerting rules
   - Health checks
   - Debugging tools

10. **[Deployment Strategy](./operations/deployment.md)**
    - Environment setup (dev, staging, production)
    - 4-phase rollout plan
    - Rollback procedure

11. **[Risk Assessment](./operations/risk-assessment.md)**
    - High/medium/low risks
    - Mitigations implemented
    - Current risk status

---

## Quick Start

### For Developers

1. Start with [High-Level Design](./01-high-level-design.md) to understand the architecture
2. Review [Implementation Plan](./02-implementation-plan.md) for timeline and phases
3. Deep dive into relevant [Design Specifications](#design-specifications) for your work
4. Check [Operations](./operations/monitoring.md) docs for monitoring and deployment

### For Project Managers

1. Review [Implementation Plan](./02-implementation-plan.md) for timeline and milestones
2. Check [Risk Assessment](./operations/risk-assessment.md) for potential issues
3. Review [Deployment Strategy](./operations/deployment.md) for rollout approach

### For Reviewers

1. Start with [High-Level Design](./01-high-level-design.md) for context
2. Focus on specific design specs based on area of expertise
3. Review embedded decisions in each design spec
4. Check [Risk Assessment](./operations/risk-assessment.md) for concerns

---

## Key Architectural Decisions

All decisions are embedded in relevant design specifications:

- **Processing State Storage**: Use Durable Objects → [Document Processor](./design/document-processor.md#decision-durable-objects-for-processing-state)
- **Chunk Content Storage**: Store in D1 for low latency → [Document Processor](./design/document-processor.md#decision-chunk-content-storage)
- **ID Type**: Use INTEGER for performance → [Database Schema](./design/database-schema.md#decision-id-type)
- **Embeddings Provider**: Start with OpenAI → [Document Processor](./design/document-processor.md#decision-embeddings-provider)
- **Tag Search**: Hybrid D1 + Vectorize → [Query Service](./design/query-service.md#decision-tag-search-strategy)
- **Shared Config**: Use packages/shared → [Shared Package](./design/shared-package.md#decision-configuration-location)

---

## Migration Status

| Phase | Status | Target Date |
|-------|--------|-------------|
| Phase 1: Infrastructure Setup | Not Started | Week 1 |
| Phase 2: R2 Sync Client | Not Started | Week 2 |
| Phase 3: Shared Package | Not Started | Week 3 |
| Phase 4: Document Processor (DO) | Not Started | Weeks 4-6 |
| Phase 5: Query Service | Not Started | Week 7 |
| Phase 6: Data Migration | Not Started | Week 8 |
| Phase 7: Integration Testing | Not Started | Week 9 |
| Phase 8: Deployment | Not Started | Week 10 |
| Rollout Phase 1: Dual-Run | Not Started | Week 10 |
| Rollout Phase 2: 50% Traffic | Not Started | Week 11 |
| Rollout Phase 3: 100% Traffic | Not Started | Week 12 |
| Rollout Phase 4: Decommission | Not Started | Week 13 |

---

## Contributing

When updating documentation:

1. Keep decisions embedded in relevant design specs
2. Update cross-references when moving content
3. Maintain consistent formatting
4. Update this README if adding new documents
5. Update Last Updated date

---

## Questions?

For questions or clarifications:
- Review the relevant design spec first
- Check the risk assessment for known issues
- Refer to embedded decisions for rationale

---

**Prepared by**: Claude Sonnet 4.5
**Date**: November 1, 2025
**Version**: 1.0
