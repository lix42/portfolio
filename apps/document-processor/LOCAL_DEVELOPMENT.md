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
- ✅ D1: Uses **local** SQLite database (fast, isolated)
- ☁️ R2: Uses **remote staging** bucket (shared)
- ☁️ Vectorize: Uses **remote staging** index (shared)
- ☁️ Queue: Uses **remote staging** queue (shared)

## Local Development Workflow

### Testing Document Processing

**Option 1: Via Queue Message**

Upload a test document to R2 staging bucket, then send a queue message:

```bash
# Upload test document
wrangler r2 object put portfolio-documents/test-local-doc.md \
  --file=./test-document.md

# Trigger processing via queue
curl -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "test-local-doc.md"}'
```

**Option 2: Direct HTTP Request**

```bash
# Start processing
curl -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "documents/example.md"}'

# Check status
curl "http://localhost:8787/status?r2Key=documents/example.md"
```

### Inspecting Local Database

```bash
# Query documents
pnpm db:query:local "SELECT * FROM documents;"

# Query chunks
pnpm db:query:local "SELECT id, document_id, LENGTH(content) as length FROM chunks LIMIT 5;"

# Query companies
pnpm db:query:local "SELECT * FROM companies;"

# Check processing progress
pnpm db:query:local "
  SELECT
    d.project,
    COUNT(c.id) as chunk_count
  FROM documents d
  LEFT JOIN chunks c ON c.document_id = d.id
  GROUP BY d.id;
"
```

### Resetting Local Database

```bash
# Local D1 is ephemeral - just restart wrangler dev
# Or manually reset:
pnpm db:query:local "DROP TABLE IF EXISTS chunks;"
pnpm db:query:local "DROP TABLE IF EXISTS documents;"
pnpm db:query:local "DROP TABLE IF EXISTS companies;"

# Re-apply schema
pnpm db:migrate:local apps/database/migrations/0001_initial_schema.sql
```

## Environment Differences

### Local Development (wrangler dev)

```
D1:        Local SQLite (in-memory, resets on restart)
R2:        Remote staging bucket (portfolio-documents)
Vectorize: Remote staging (portfolio-embeddings-staging)
Queue:     Remote staging (portfolio-doc-processing-staging)
```

**Use R2 test prefixes**: `test-yourname-document.md` to avoid conflicts

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
# Solution: Upload test document first
wrangler r2 object put portfolio-documents/test-doc.md --file=./test.md
```

**Issue**: Local D1 is empty after restart
```bash
# Expected: Local D1 is ephemeral, re-apply migrations
pnpm db:migrate:local apps/database/migrations/0001_initial_schema.sql
```

## Advanced: Full Local Setup with Miniflare

For complete local isolation (no remote resources):

```bash
# Install miniflare
pnpm add -D miniflare

# Run with miniflare
pnpm miniflare --config miniflare.toml

# Note: Vectorize will be mocked (no real embeddings)
```

## Next Steps

- [Infrastructure Management Guide](../../docs/cloudflare-migration/operations/infrastructure-management.md)
- [Database Migrations](../database/README.md)
- [Phase 4 Execution Plan](../../docs/cloudflare-migration/execution-plans/phase-4-execution-plan.md)
