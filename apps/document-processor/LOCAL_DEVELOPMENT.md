# Local Development Guide

## Quick Start

### 1. Setup Local Database

```bash
# Apply schema to local D1
pnpm db:migrate:local apps/database/migrations/0001_initial_schema.sql

# (Optional) Add test data
pnpm db:migrate:local apps/database/migrations/0002_test_data.sql

# Verify schema
pnpm db:query:local "SELECT name FROM sqlite_master WHERE type='table';"
```

### 2. Set Environment Variables

```bash
# Copy example file
cp .dev.vars.example .dev.vars

# Edit .dev.vars and add your OpenAI API key
# OPENAI_API_KEY=sk-...
```

### 3. Start Development Server

```bash
# From apps/document-processor
pnpm dev

# Or from root
pnpm --filter @portfolio/document-processor dev
```

**What happens when you run `pnpm dev`**:
- ☁️ D1: Uses **remote staging** database (shared)
- ✅ R2: Uses **local** storage (.wrangler/state/v3/r2/)
- ☁️ Vectorize: Uses **remote staging** index (shared)
- ✅ Queue: Uses **local** queue (portfolio-doc-processing-local, not currently used)

## Local Development Workflow

### Testing Document Processing

**Current Approach: Direct HTTP Request with Local R2**

Local testing uses the Worker's `fetch` API (not queue-based) with documents stored in local R2:

```bash
# 1. Sync test documents from /documents/experiments/ to local R2
./sync-experiments.sh

# 2. Verify documents are in local R2
sqlite3 .wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite \
  "SELECT key FROM _mf_objects WHERE key LIKE 'experiments/%' ORDER BY key;"

# 3. Trigger processing via HTTP
./test-local.sh

# Or manually:
curl -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "experiments/test.md"}'

# 4. Check status
curl "http://localhost:8787/status?r2Key=experiments/test.md"

# 5. Reprocess a document (cleans up existing data and restarts)
curl -X POST http://localhost:8787/reprocess \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "experiments/test.md"}'
```

**Managing Local R2 Storage:**

```bash
# Sync all files from /documents/experiments/ to local R2
./sync-experiments.sh

# Clean up local R2 storage
./clean-local-r2.sh

# Check what's in local R2
sqlite3 .wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite \
  "SELECT key FROM _mf_objects ORDER BY key;"
```

**Future: Queue-Based Testing**

The local queue (`portfolio-doc-processing-local`) exists but is not currently used for testing. In the future, you can test the full queue-based workflow:

```bash
# Upload to local R2
wrangler r2 object put portfolio-documents/test-doc.md \
  --file=./test.md --local

# Send message to local queue (would trigger queue consumer)
# This requires additional setup and is not part of the current workflow
```

### Inspecting Remote D1 Database

Since local dev uses the remote staging D1 database, query it with:

```bash
# Query documents
wrangler d1 execute portfolio-sql-staging \
  --command "SELECT * FROM documents;"

# Query chunks
wrangler d1 execute portfolio-sql-staging \
  --command "SELECT id, document_id, LENGTH(content) as length FROM chunks LIMIT 5;"

# Query companies
wrangler d1 execute portfolio-sql-staging \
  --command "SELECT * FROM companies;"

# Check processing progress
wrangler d1 execute portfolio-sql-staging \
  --command "SELECT d.project, COUNT(c.id) as chunk_count
             FROM documents d
             LEFT JOIN chunks c ON c.document_id = d.id
             GROUP BY d.id;"
```

**Note:** Be careful when modifying the staging database during local development, as it's shared with deployed staging workers.

## Environment Differences

### Local Development (wrangler dev)

```
D1:        Remote staging (portfolio-sql-staging) - SHARED
R2:        Local storage (.wrangler/state/v3/r2/portfolio-documents/) - ISOLATED
Vectorize: Remote staging (portfolio-embeddings-staging) - SHARED
Queue:     Local queue (portfolio-doc-processing-local) - ISOLATED (not used)
```

**Current Testing Workflow:**
- Documents stored in **local R2** (use `./sync-experiments.sh` to populate)
- Worker triggered via **HTTP fetch API** (not queue consumer)
- Durable Objects process documents locally
- Results stored in **remote staging D1** and **Vectorize**

**Important Notes:**
- **D1 is shared** with staging deployment - be careful not to interfere with production-like testing
- **R2 is local** - changes won't affect staging/production
- **Queue exists but is not used** for current local testing workflow

### Staging Deployment

```bash
pnpm deploy:staging
```

```
D1:        Remote staging (portfolio-staging)
R2:        Shared bucket (portfolio-documents)
Vectorize: Remote staging (portfolio-embeddings-staging)
Queue:     Remote staging (portfolio-doc-processing-staging)
```

### Production Deployment

```bash
pnpm deploy:prod
```

```
D1:        Remote production (portfolio-prod)
R2:        Shared bucket (portfolio-documents)
Vectorize: Remote production (portfolio-embeddings-prod)
Queue:     Remote production (portfolio-doc-processing-prod)
```

## Debugging Tips

### Enable Verbose Logging

Edit `wrangler.jsonc` to add:

```jsonc
{
  "vars": {
    "ENVIRONMENT": "local",
    "LOG_LEVEL": "debug"
  }
}
```

### Check Durable Object State

```bash
# Get processing status
curl "http://localhost:8787/status?r2Key=test-doc.md"

# Resume failed processing
curl -X POST http://localhost:8787/resume \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "test-doc.md"}'
```

### Inspect Remote Resources

```bash
# Check R2 contents
wrangler r2 object list portfolio-documents --prefix="test-"

# Check Vectorize index
wrangler vectorize get portfolio-embeddings-staging

# Check queue depth
wrangler queues list
```

### Common Issues

**Issue**: "Table not found"
```bash
# Solution: Apply migrations to local D1
pnpm db:migrate:local apps/database/migrations/0001_initial_schema.sql
```

**Issue**: "OpenAI API key missing"
```bash
# Solution: Check .dev.vars file exists and has OPENAI_API_KEY
cat .dev.vars
```

**Issue**: "R2 object not found"
```bash
# Solution: Sync documents to local R2
./sync-experiments.sh

# Or manually add a specific file
wrangler r2 object put portfolio-documents/test-doc.md \
  --file=./test.md --local
```

**Issue**: Local R2 is empty after restart
```bash
# Expected: Local R2 storage resets when wrangler dev restarts
# Solution: Run sync script to repopulate
./sync-experiments.sh
```

## Architecture: Worker APIs

The document processor worker exports two APIs:

### 1. Queue Consumer API (Production)
```typescript
export default {
  async queue(batch: MessageBatch, env: Env) {
    // Triggered by R2 event notifications
    // Used in staging/production deployments
  }
}
```

**Used in:** Staging and production environments where R2 bucket events send messages to the queue.

### 2. HTTP Fetch API (Local Testing + Manual Triggers)
```typescript
export default {
  async fetch(request: Request, env: Env) {
    // POST /process - manually trigger processing
    // GET /status - check processing status
    // POST /reprocess - reprocess existing document
    // POST /resume - resume failed processing
  }
}
```

**Used in:**
- Local development for testing
- Manual triggers in staging/production
- Reprocessing documents
- Status checks and debugging

Both APIs delegate to the same `DocumentProcessor` Durable Object, which handles the actual processing pipeline.

## Next Steps

- [Infrastructure Management Guide](../../docs/cloudflare-migration/operations/infrastructure-management.md)
- [Database Migrations](../database/README.md)
- [Phase 4 Execution Plan](../../docs/cloudflare-migration/execution-plans/phase-4-execution-plan.md)
