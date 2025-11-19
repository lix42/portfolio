# Infrastructure Management Guide

**Version**: 1.0
**Last Updated**: November 16, 2025

---

## Overview

This guide covers how to manage Cloudflare infrastructure resources (D1, Vectorize, R2, Queues, Durable Objects) for the Portfolio RAG system.

---

## Environment Strategy

### Two-Environment Setup

We use **only two environments**:
- **staging**: Pre-production testing
- **production**: Live production

**Local development** uses:
- Local D1 (via `wrangler dev --local`)
- Remote staging resources for testing
- Miniflare for full local simulation (optional)

### Resource Naming Convention

```
{resource-type}-{environment}

Actual Resources:
- portfolio-sql-staging (D1)
- portfolio-sql-prod (D1)
- portfolio-embeddings-staging (Vectorize)
- portfolio-embeddings-prod (Vectorize)
- portfolio-documents (R2 - single shared bucket)
- portfolio-doc-processing-staging (Queue)
- portfolio-doc-processing-prod (Queue)
- portfolio-doc-processing-staging-dlq (Dead Letter Queue)
- portfolio-doc-processing-prod-dlq (Dead Letter Queue)
```

---

## Database Migrations

### Migration File Structure

```
apps/database/migrations/
├── 0001_initial_schema.sql      # Initial schema
├── 0002_test_data.sql           # Test data (dev/staging only)
├── 0003_add_column_example.sql  # Example migration
└── README.md                    # Migration documentation
```

### Migration Naming Convention

Format: `{number}_{description}.sql`
- Number: 4-digit sequential (0001, 0002, 0003, ...)
- Description: Snake_case, describes the change
- Examples:
  - `0003_add_content_to_documents.sql`
  - `0004_add_chunk_tokens_column.sql`
  - `0005_create_processing_logs_table.sql`

### Creating a New Migration

**Step 1: Create migration file**

```bash
# Create new migration file
cat > apps/database/migrations/0003_add_chunk_tokens_column.sql << 'EOF'
-- ============================================
-- Add tokens column to chunks table
-- Migration: 0003
-- Created: 2025-11-16
-- ============================================

-- Add tokens column to track chunk size
ALTER TABLE chunks ADD COLUMN tokens INTEGER;

-- Backfill with estimated tokens (content length / 4)
UPDATE chunks SET tokens = LENGTH(content) / 4 WHERE tokens IS NULL;

-- Make column required going forward
-- (D1/SQLite doesn't support ALTER COLUMN, so we accept NULL for now)

-- Verification
SELECT COUNT(*) as updated_count FROM chunks WHERE tokens IS NOT NULL;
EOF
```

**Step 2: Test locally**

```bash
# Apply to local database
wrangler d1 execute portfolio-sql-staging \
  --local \
  --file=apps/database/migrations/0003_add_chunk_tokens_column.sql

# Verify locally
wrangler d1 execute portfolio-sql-staging \
  --local \
  --command="SELECT * FROM chunks LIMIT 1;"
```

**Step 3: Apply to staging**

```bash
# Apply to remote staging
wrangler d1 execute portfolio-sql-staging \
  --remote \
  --file=apps/database/migrations/0003_add_chunk_tokens_column.sql

# Verify
wrangler d1 execute portfolio-sql-staging \
  --remote \
  --command="SELECT COUNT(*) FROM chunks WHERE tokens IS NOT NULL;"
```

**Step 4: Apply to production**

```bash
# Apply to remote production
wrangler d1 execute portfolio-sql-prod \
  --remote \
  --file=apps/database/migrations/0003_add_chunk_tokens_column.sql

# Verify
wrangler d1 execute portfolio-sql-prod \
  --remote \
  --command="SELECT COUNT(*) FROM chunks WHERE tokens IS NOT NULL;"
```

### Migration Best Practices

1. **Always test locally first** using `--local` flag
2. **Apply to staging before production**
3. **Make migrations idempotent** (use `IF NOT EXISTS`, check before update)
4. **Keep migrations small and focused** (one logical change per migration)
5. **Document rollback steps** in migration file comments
6. **Avoid destructive operations** in production (DROP, TRUNCATE)
7. **Use transactions implicitly** (D1 wraps each migration in a transaction)

### Complex Migration Example

```sql
-- ============================================
-- Refactor: Split company into separate field
-- Migration: 0004
-- Created: 2025-11-16
-- Rollback: See end of file
-- ============================================

-- Step 1: Add new columns
ALTER TABLE documents ADD COLUMN company TEXT;
ALTER TABLE documents ADD COLUMN content TEXT;

-- Step 2: Backfill data from existing columns
-- (Assuming we can derive company from somewhere)
UPDATE documents
SET company = (SELECT name FROM companies WHERE id = documents.company_id);

-- Step 3: Verify backfill
SELECT COUNT(*) as backfilled FROM documents WHERE company IS NOT NULL;

-- Step 4: Note - we keep company_id for backward compatibility during transition
-- In a future migration, we can drop company_id after full migration

-- ============================================
-- Rollback Instructions (manual)
-- ============================================
-- If this migration causes issues:
-- 1. Deploy previous Worker version
-- 2. Run: ALTER TABLE documents DROP COLUMN company;
-- 3. Run: ALTER TABLE documents DROP COLUMN content;
```

---

## CI/CD Migration Strategy (Future)

### Automated Migrations (Phase 5+)

**Option 1: GitHub Actions Workflow**

```yaml
# .github/workflows/deploy-migrations.yml
name: Deploy Database Migrations

on:
  push:
    paths:
      - 'apps/database/migrations/*.sql'
    branches:
      - main

jobs:
  migrate-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install wrangler
        run: pnpm add -g wrangler

      - name: Apply migrations to staging
        run: |
          for file in apps/database/migrations/*.sql; do
            wrangler d1 execute portfolio-staging \
              --remote \
              --file="$file"
          done
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Verify staging
        run: |
          wrangler d1 execute portfolio-staging \
            --remote \
            --command="SELECT name FROM sqlite_master WHERE type='table';"

  migrate-production:
    needs: migrate-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      # Same steps but for portfolio-prod
```

**Option 2: Wrangler Migrations (Built-in)**

Future wrangler versions may support migrations natively:

```jsonc
// wrangler.jsonc (future)
{
  "migrations": {
    "directory": "apps/database/migrations",
    "on_deploy": "auto"  // Apply migrations automatically on deploy
  }
}
```

---

## Local Development Setup

### Option 1: Local-First (Recommended for Quick Development)

**Uses**:
- Local D1 (in-memory SQLite)
- Remote staging R2/Vectorize/Queues

**Setup**:

```bash
# 1. Apply migrations locally
wrangler d1 execute portfolio-sql-staging \
  --local \
  --file=apps/database/migrations/0001_initial_schema.sql

wrangler d1 execute portfolio-sql-staging \
  --local \
  --file=apps/database/migrations/0002_test_data.sql

# 2. Run local dev server (uses staging R2/Vectorize/Queue)
cd apps/document-processor
pnpm dev

# Note: wrangler dev uses local D1 by default, but remote bindings for R2/Vectorize/Queue
```

**wrangler.jsonc** (default environment):
```jsonc
{
  "name": "portfolio-document-processor",

  // Default bindings - used by wrangler dev
  "d1_databases": [{
    "binding": "DB",
    "database_name": "portfolio-sql-staging",
    "database_id": "b287f8a6-1760-4092-8f2f-3f3f453cfe4f"
  }],

  "r2_buckets": [{
    "binding": "DOCUMENTS_BUCKET",
    "bucket_name": "portfolio-documents"
  }],

  "vectorize": [{
    "binding": "VECTORIZE",
    "index_name": "portfolio-embeddings-staging"
  }],

  "queues": {
    "producers": [{
      "binding": "PROCESSING_QUEUE",
      "queue": "portfolio-doc-processing-staging"
    }]
  }
}
```

**Pros**:
- Fast local D1 (no network latency)
- Real R2/Vectorize data for testing
- Easy to reset local D1

**Cons**:
- Shares R2/Vectorize with staging (use test prefixes)
- Need to re-apply migrations after `wrangler dev` restart

### Option 2: Full Local with Miniflare (Advanced)

**Uses**:
- Local D1
- Local R2 (file-based)
- Local Vectorize (mock)
- Local Queues (in-memory)

**Setup**:

```bash
# Install miniflare
pnpm add -D miniflare

# Create miniflare config
cat > apps/document-processor/miniflare.toml << 'EOF'
[miniflare]
name = "portfolio-document-processor"
compatibility_date = "2025-10-28"
compatibility_flags = ["nodejs_compat_v2"]

# Local bindings
[[d1_databases]]
binding = "DB"
database_name = "portfolio-local"

[[r2_buckets]]
binding = "DOCUMENTS_BUCKET"
bucket_name = "portfolio-documents-local"

[[vectorize]]
binding = "VECTORIZE"
index_name = "portfolio-embeddings-local"

[[queues.producers]]
binding = "PROCESSING_QUEUE"
queue = "portfolio-doc-processing-local"
EOF

# Run with miniflare
pnpm miniflare --config miniflare.toml
```

**Pros**:
- Fully isolated local environment
- No risk of polluting staging
- Reproducible setup

**Cons**:
- More complex setup
- Vectorize is mocked (no real similarity search)
- Slower to set up initially

### Recommended Approach

For **document-processor development**:
1. Use **Option 1** (local D1 + remote staging resources)
2. Use test prefixes in R2 keys: `test-{username}-{filename}.md`
3. Periodically clean up test data from staging

For **isolated testing**:
1. Use **Option 2** (Miniflare) for full isolation
2. Useful for integration tests in CI/CD

---

## Resource Management

### Creating New Resources

#### D1 Database

```bash
# Create database
wrangler d1 create portfolio-sql-{environment}

# Note the database_id from output
# Add to wrangler.jsonc

# Existing databases:
# - portfolio-sql-staging (b287f8a6-1760-4092-8f2f-3f3f453cfe4f)
# - portfolio-sql-prod (e8ae40da-e089-47f8-8845-7586f7a555ec)
```

#### Vectorize Index

```bash
# Create index
wrangler vectorize create portfolio-embeddings-{environment} \
  --dimensions=1536 \
  --metric=cosine

# Verify
wrangler vectorize list
```

#### R2 Bucket

```bash
# Create bucket (single shared bucket for all environments)
wrangler r2 bucket create portfolio-documents

# Verify
wrangler r2 bucket list

# Existing bucket:
# - portfolio-documents (shared across all environments)
```

#### Queue

```bash
# Create queue
wrangler queues create portfolio-doc-processing-{environment}

# Create dead letter queue
wrangler queues create portfolio-doc-processing-{environment}-dlq

# Verify
wrangler queues list
```

#### Durable Object

Durable Objects are defined in code and automatically created on first use.

**In wrangler.jsonc**:
```jsonc
{
  "durable_objects": {
    "bindings": [{
      "name": "DOCUMENT_PROCESSOR",
      "class_name": "DocumentProcessor",
      "script_name": "portfolio-document-processor"
    }]
  }
}
```

**No manual creation needed** - instances are created on-demand via `idFromName()` or `newUniqueId()`.

### Deleting Resources

```bash
# Delete database (⚠️ DESTRUCTIVE)
wrangler d1 delete portfolio-sql-{environment}

# Delete Vectorize index (⚠️ DESTRUCTIVE)
wrangler vectorize delete portfolio-embeddings-{environment}

# Delete R2 bucket (⚠️ DESTRUCTIVE - must be empty)
wrangler r2 bucket delete portfolio-documents

# Delete queue (⚠️ DESTRUCTIVE)
wrangler queues delete portfolio-doc-processing-{environment}
```

**⚠️ Warning**: These operations are irreversible. Always backup data first.

### Resource Inspection

```bash
# List all resources
wrangler d1 list
wrangler vectorize list
wrangler r2 bucket list
wrangler queues list

# Inspect database
wrangler d1 execute portfolio-sql-staging \
  --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table';"

# Query Vectorize
wrangler vectorize query portfolio-embeddings-staging \
  --vector="[0.1, 0.2, ...]" \
  --top-k=5

# List R2 objects
wrangler r2 object list portfolio-documents --prefix="test-"

# Inspect queue
wrangler queues consumer add portfolio-doc-processing-staging \
  --batch-size=10
```

---

## NPM Scripts for Database Management

### Add to Root package.json

```json
{
  "scripts": {
    "db:migrate:local": "wrangler d1 execute portfolio-sql-staging --local --file",
    "db:migrate:staging": "wrangler d1 execute portfolio-sql-staging --remote --file",
    "db:migrate:prod": "wrangler d1 execute portfolio-sql-prod --remote --file",
    "db:query:local": "wrangler d1 execute portfolio-sql-staging --local --command",
    "db:query:staging": "wrangler d1 execute portfolio-sql-staging --remote --command",
    "db:query:prod": "wrangler d1 execute portfolio-sql-prod --remote --command",
    "db:shell:staging": "wrangler d1 execute portfolio-sql-staging --remote",
    "db:shell:prod": "wrangler d1 execute portfolio-sql-prod --remote"
  }
}
```

### Usage Examples

```bash
# Apply migration to local
pnpm db:migrate:local apps/database/migrations/0003_add_column.sql

# Apply migration to staging
pnpm db:migrate:staging apps/database/migrations/0003_add_column.sql

# Query staging
pnpm db:query:staging "SELECT COUNT(*) FROM documents;"

# Interactive shell (staging)
pnpm db:shell:staging
```

---

## Monitoring & Maintenance

### Regular Checks

**Weekly**:
- Check D1 database size: `wrangler d1 info portfolio-{env}`
- Check Vectorize index health: `wrangler vectorize get portfolio-embeddings-{env}`
- Review R2 storage usage: Cloudflare dashboard
- Check queue depth: `wrangler queues list`

**Monthly**:
- Review and clean up test data
- Archive old Durable Object instances
- Review and optimize indexes

### Backup Strategy

**D1**:
```bash
# Export database
wrangler d1 export portfolio-sql-prod > backup-$(date +%Y%m%d).sql

# Restore database
wrangler d1 execute portfolio-sql-prod --file=backup-20251116.sql
```

**R2**:
- Use Cloudflare R2's built-in versioning
- Or use `rclone` for external backups

**Vectorize**:
- Re-generate from D1 documents table if needed
- Keep document content in D1 as source of truth

---

## Related Documents

- [Database Schema Design](../design/database-schema.md)
- [Deployment Strategy](./deployment.md)
- [Resource Setup Checklist](./resource-setup-checklist.md)
