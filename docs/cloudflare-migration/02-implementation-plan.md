# Implementation Plan

**Version**: 1.0
**Last Updated**: November 1, 2025
**Total Timeline**: 13 weeks (10 weeks implementation + 3 weeks rollout)

---

## Overview

This document outlines the phased implementation approach for migrating from Supabase to Cloudflare. Each phase includes tasks, deliverables, and links to relevant design specifications.

---

## Phase 1: Infrastructure Setup (Week 1) ✅

**Status**: ✅ COMPLETE (2025-11-02)
**Goal**: Set up Cloudflare resources and development environment

### Tasks

1. **Create Cloudflare resources**
   - [x] Create D1 database (dev, staging, production)
   - [x] Create Vectorize index
   - [x] Create R2 bucket
   - [x] Create Queue for document processing (with DLQs)
   - [ ] Configure Durable Objects namespace (deferred to Phase 4)

2. **Database schema**
   - [x] Run D1 migration scripts
   - [x] Create tables: companies, documents, chunks
   - [x] Create indexes (8 indexes)
   - [x] Verify schema with test data

3. **Development environment**
   - [x] Install Wrangler CLI (v4.45.3)
   - [x] Configure local D1 instance
   - [x] Set up local development with test data
   - [x] Configure environment variables (.dev.vars)

4. **Access control**
   - [x] Wrangler authentication verified
   - [x] Configure permissions (Workers Paid plan)
   - [x] Set up CI/CD secrets documentation

### Deliverables

- ✅ D1 database with schema (3 environments)
- ✅ Vectorize index configured (3 environments, 1536 dims, cosine)
- ✅ R2 bucket created (3 environments)
- ✅ Queues created (6 total: 3 main + 3 DLQs)
- ✅ Local development environment ready
- ✅ Infrastructure as Code (wrangler.jsonc)
- ✅ Helper scripts (dev, deploy, verify)
- ✅ Complete verification suite

### References

- [Database Schema](./design/database-schema.md)
- [High-Level Design](./01-high-level-design.md)
- [Phase 1 Completion Report](./execution-plans/phase-1-completion-report.md) ✅
- [Phase 1 Resource IDs](./execution-plans/phase-1-resources.json)

---

## Phase 2: R2 Sync Client (Week 2)

**Goal**: Build CLI tool to sync local documents to R2

### Tasks

1. **Create project structure**
   - [ ] Initialize `apps/r2-sync/` package
   - [ ] Set up TypeScript configuration
   - [ ] Install dependencies (commander, chalk, wrangler)

2. **Implement core logic**
   - [ ] File listing (local and R2)
   - [ ] SHA-256 hashing for change detection
   - [ ] Diff computation
   - [ ] Upload/delete operations

3. **CLI interface**
   - [ ] Interactive mode with confirmation
   - [ ] Dry-run mode
   - [ ] CI/CD mode with JSON output
   - [ ] Progress reporting

4. **Testing**
   - [ ] Unit tests for syncer logic
   - [ ] Integration tests with mock R2
   - [ ] Manual testing with real R2 bucket

5. **CI/CD integration**
   - [ ] GitHub Actions workflow
   - [ ] Trigger on document changes
   - [ ] Deploy to R2 automatically

### Deliverables

- Functional R2 sync CLI tool
- Automated sync in CI/CD pipeline
- All documents synced to R2

### References

- [R2 Sync Client Design](./design/r2-sync-client.md)

---

## Phase 3: Shared Package (Week 3)

**Goal**: Extract shared business logic into reusable package

### Tasks

1. **Create package structure**
   - [ ] Initialize `packages/shared/`
   - [ ] Set up TypeScript configuration
   - [ ] Configure as monorepo workspace

2. **Migrate prompts**
   - [ ] Convert `documents/prompts.json` to TypeScript
   - [ ] Create `src/prompts.ts` with typed constants
   - [ ] Update references in existing code

3. **Implement utilities**
   - [ ] `src/chunking.ts` - Markdown chunking logic
   - [ ] `src/embeddings.ts` - OpenAI embedding utilities
   - [ ] `src/tags.ts` - Tag extraction logic
   - [ ] `src/constants.ts` - Shared constants

4. **Testing**
   - [ ] Unit tests for all utilities
   - [ ] Test chunking with various markdown formats
   - [ ] Mock OpenAI API in tests

5. **Documentation**
   - [ ] README with usage examples
   - [ ] API documentation
   - [ ] Migration guide from documents/prompts.json

### Deliverables

- `@portfolio/shared` package
- All utilities tested and documented
- Prompts migrated from JSON

### References

- [Shared Package Design](./design/shared-package.md)

---

## Phase 4: Document Processor with Durable Objects (Weeks 4-6)

**Goal**: Build event-driven document ingestion pipeline

### Tasks

1. **Create Worker and Durable Object structure**
   - [ ] Initialize `apps/document-processor/`
   - [ ] Implement `DocumentProcessor` Durable Object class
   - [ ] Configure bindings (D1, R2, Vectorize, Queue, DO)
   - [ ] Set up TypeScript with DO types

2. **Implement Durable Object state machine**
   - [ ] Design state storage schema
   - [ ] Implement download and chunking step
   - [ ] Implement embeddings batch processing (10 chunks/batch)
   - [ ] Implement tags batch processing (5 chunks/batch)
   - [ ] Implement two-phase commit to D1/Vectorize
   - [ ] Add alarm-based step scheduling
   - [ ] Create progress tracking methods

3. **Build Worker entry points**
   - [ ] Queue consumer that delegates to DO
   - [ ] HTTP endpoints for manual triggers
   - [ ] Status query API via DO
   - [ ] Retry mechanism with exponential backoff

4. **Error handling and recovery**
   - [ ] Implement retry logic in DO (max 3 attempts)
   - [ ] Handle partial failures gracefully
   - [ ] Store error details in DO state
   - [ ] Alert on persistent failures

5. **Testing**
   - [ ] Unit tests for DO state transitions
   - [ ] Test step isolation (each under limits)
   - [ ] Integration tests with mocked OpenAI
   - [ ] End-to-end tests with local stack
   - [ ] Test DO persistence and recovery
   - [ ] Load testing with concurrent processing

6. **R2 Reconciliation Worker**
   - [ ] Daily cron job setup
   - [ ] R2 bucket listing logic
   - [ ] Comparison with D1 records
   - [ ] Queue missing documents
   - [ ] Handle stuck processing jobs (>24 hours)

7. **Monitoring**
   - [ ] DO state inspection endpoints
   - [ ] Processing pipeline metrics
   - [ ] Error rate tracking
   - [ ] Alerting for stuck jobs

### Deliverables

- Functional document processor with Durable Objects
- R2 reconciliation worker
- State machine that handles any document size
- Comprehensive test coverage (>80%)
- Monitoring and observability setup

### References

- [Document Processor Design](./design/document-processor.md)
- [R2 Reconciliation Worker Design](./design/r2-reconciliation.md)
- [Monitoring & Observability](./operations/monitoring.md)

---

## Phase 5: Update Query Service (Week 7)

**Goal**: Update existing service to use Cloudflare bindings

### Tasks

1. **Create data access layer**
   - [ ] `CloudflareDataAccess` class
   - [ ] Vectorize query methods
   - [ ] D1 query methods
   - [ ] Type definitions for bindings

2. **Update context retrieval**
   - [ ] Replace Supabase calls in `getContext.ts`
   - [ ] Implement hybrid search (Vectorize + D1)
   - [ ] Add R2 document fetching if needed
   - [ ] Implement fallback logic

3. **Update query utilities**
   - [ ] Modify `utils/query.ts` for D1
   - [ ] Remove Supabase RPC function calls
   - [ ] Implement tag matching with JSON functions
   - [ ] Optimize query performance

4. **Update chat endpoint**
   - [ ] Pass CloudflareBindings instead of Supabase client
   - [ ] Update error handling
   - [ ] Maintain backward compatibility in responses

5. **Testing**
   - [ ] Update existing unit tests
   - [ ] Add tests for new data access layer
   - [ ] Integration tests with local bindings
   - [ ] Performance comparison with Supabase version
   - [ ] Manual testing with sample queries

6. **Cleanup**
   - [ ] Remove Supabase dependencies from package.json
   - [ ] Remove unused imports and code
   - [ ] Update wrangler.jsonc with bindings
   - [ ] Update documentation

### Deliverables

- Updated query service using Cloudflare bindings
- All tests passing
- Performance benchmarks (< 2s p95)
- No Supabase dependencies

### References

- [Query Service Design](./design/query-service.md)
- [Database Schema](./design/database-schema.md)

---

## Phase 6: Data Migration (Week 8)

**Goal**: Migrate existing data from Supabase to Cloudflare

### Tasks

1. **Export from Supabase**
   - [ ] Script to export companies
   - [ ] Script to export documents (with full content)
   - [ ] Export chunks metadata (not embeddings)
   - [ ] Save exports as JSON files

2. **Prepare for import**
   - [ ] Convert data formats (UUIDs, dates, arrays)
   - [ ] Create UUID→INTEGER mapping table
   - [ ] Validate data integrity

3. **Import to D1**
   - [ ] Import companies
   - [ ] Import documents
   - [ ] Verify foreign key relationships
   - [ ] Create indexes

4. **Trigger reprocessing**
   - [ ] Documents already in R2
   - [ ] Queue all documents for processing
   - [ ] Document processor will generate new chunks
   - [ ] Wait for processing to complete
   - [ ] Verify chunk counts match expected

5. **Verification**
   - [ ] Compare record counts (companies, documents)
   - [ ] Spot-check data accuracy
   - [ ] Verify Vectorize embeddings count
   - [ ] Test sample queries

6. **Rollback preparation**
   - [ ] Export Cloudflare data
   - [ ] Document rollback procedure
   - [ ] Test rollback on staging

### Deliverables

- All data migrated to Cloudflare
- Verification report
- Rollback procedure documented and tested

### References

- [Database Schema](./design/database-schema.md)
- [Deployment Strategy](./operations/deployment.md#rollback-procedure)

---

## Phase 7: Integration & End-to-End Testing (Week 9)

**Goal**: Validate entire system works together

### Tasks

1. **End-to-end workflows**
   - [ ] Sync documents with R2 sync client
   - [ ] Verify R2 event triggers processing
   - [ ] Confirm documents processed correctly
   - [ ] Test query service returns correct results

2. **Performance testing**
   - [ ] Load testing (100 concurrent queries)
   - [ ] Measure P95 latency
   - [ ] Test document processing throughput
   - [ ] Benchmark against Supabase

3. **Edge cases**
   - [ ] Large documents (>1000 chunks)
   - [ ] Empty documents
   - [ ] Malformed markdown
   - [ ] Network failures and retries
   - [ ] Concurrent updates to same document

4. **Reconciliation testing**
   - [ ] Manually skip R2 events
   - [ ] Run reconciliation worker
   - [ ] Verify missed documents are processed

5. **Monitoring validation**
   - [ ] Verify all metrics collecting
   - [ ] Test alert triggers
   - [ ] Check dashboard displays
   - [ ] Validate error logging

6. **Documentation updates**
   - [ ] Update README with new architecture
   - [ ] Document operational procedures
   - [ ] Create runbook for common issues

### Deliverables

- All end-to-end tests passing
- Performance benchmarks met
- Monitoring dashboards live
- Documentation updated

### References

- [High-Level Design](./01-high-level-design.md)
- [Monitoring & Observability](./operations/monitoring.md)

---

## Phase 8: Deployment & Monitoring (Week 10)

**Goal**: Deploy to production and begin rollout

### Tasks

1. **Staging deployment**
   - [ ] Deploy all components to staging
   - [ ] Run full regression test suite
   - [ ] Performance validation
   - [ ] Fix any issues found

2. **Production deployment**
   - [ ] Deploy document processor
   - [ ] Deploy reconciliation worker
   - [ ] Deploy updated query service
   - [ ] Verify health checks passing

3. **Feature flag setup**
   - [ ] Implement gradual rollout flag
   - [ ] Start with 0% (monitoring only)
   - [ ] Configure monitoring dashboards
   - [ ] Set up alert notifications

4. **Monitoring**
   - [ ] Real-time error rate monitoring
   - [ ] Latency tracking (P50, P95, P99)
   - [ ] Cost tracking
   - [ ] User feedback collection

5. **Cleanup**
   - [ ] Archive Python ingestion scripts
   - [ ] Remove old build artifacts
   - [ ] Update CI/CD pipelines
   - [ ] Clean up old environment variables

### Deliverables

- Production deployment complete
- Monitoring dashboards live
- All systems operational
- Ready for gradual rollout

### References

- [Deployment Strategy](./operations/deployment.md)
- [Monitoring & Observability](./operations/monitoring.md)

---

## Rollout Phases (Weeks 10-13)

### Phase 1: Dual-Run (Week 10)

**Goal**: Validate Cloudflare stack with 10% traffic

- Deploy Cloudflare stack to production
- Keep Supabase operational
- Route 10% of traffic to new stack
- Compare results and performance
- Monitor error rates closely

**Success Criteria**:
- Zero errors on Cloudflare stack
- Query latency < 2s (p95)
- Results match Supabase

### Phase 2: Gradual Migration (Week 11)

**Goal**: Increase to 50% traffic

- Increase traffic to 50%
- Monitor error rates and performance
- Fix issues as they arise
- Continue data sync between systems

**Success Criteria**:
- Error rate < 1%
- No performance degradation
- User feedback positive

### Phase 3: Full Migration (Week 12)

**Goal**: Route 100% traffic to Cloudflare

- Increase traffic to 100%
- Keep Supabase as read-only backup
- Monitor for 1 week
- Disable Supabase writes

**Success Criteria**:
- Zero production incidents
- Performance targets met
- Data consistency verified

### Phase 4: Decommission (Week 13)

**Goal**: Archive Supabase and finalize

- Export final Supabase backup
- Cancel Supabase subscription
- Remove Supabase code references
- Remove feature flags
- Update documentation

### References

- [Deployment Strategy](./operations/deployment.md#rollout-plan)
- [Risk Assessment](./operations/risk-assessment.md)

---

## Success Criteria Summary

### Functional Requirements

- ✅ All existing queries return equivalent results
- ✅ Document ingestion fully automated via R2 events
- ✅ Support for documents of any size
- ✅ Self-healing system (reconciliation)

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

## Timeline Summary

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| 1. Infrastructure Setup | 1 week | Week 1 | Week 1 |
| 2. R2 Sync Client | 1 week | Week 2 | Week 2 |
| 3. Shared Package | 1 week | Week 3 | Week 3 |
| 4. Document Processor (DO) | 3 weeks | Week 4 | Week 6 |
| 5. Query Service | 1 week | Week 7 | Week 7 |
| 6. Data Migration | 1 week | Week 8 | Week 8 |
| 7. Integration Testing | 1 week | Week 9 | Week 9 |
| 8. Deployment | 1 week | Week 10 | Week 10 |
| **Implementation Total** | **10 weeks** | Week 1 | Week 10 |
| Rollout Phase 1 (Dual-Run) | 1 week | Week 10 | Week 10 |
| Rollout Phase 2 (50%) | 1 week | Week 11 | Week 11 |
| Rollout Phase 3 (100%) | 1 week | Week 12 | Week 12 |
| Rollout Phase 4 (Decommission) | 1 week | Week 13 | Week 13 |
| **Rollout Total** | **3 weeks** | Week 10 | Week 13 |
| **Grand Total** | **13 weeks** | Week 1 | Week 13 |

---

## Key Principles

1. **Incremental delivery**: Each phase delivers working software
2. **Test-driven**: Comprehensive testing at every level
3. **Data safety**: Keep Supabase operational until fully validated
4. **Monitoring first**: Observability before scaling
5. **Clear communication**: Regular updates to stakeholders

---

## Next Steps

1. ✅ Review and approve this implementation plan
2. ⏭️ Begin Phase 1: Infrastructure Setup
3. ⏭️ Set up project tracking (GitHub Projects, Jira, etc.)
4. ⏭️ Schedule weekly progress reviews

---

## Related Documents

- [High-Level Design](./01-high-level-design.md)
- [All Design Specifications](./design/)
- [All Operations Documents](./operations/)
- [Project README](./README.md)
