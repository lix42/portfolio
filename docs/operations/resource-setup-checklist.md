# Cloudflare Resource Setup Checklist

**Current Status**: ✅ Resources created with correct naming convention (2-environment architecture)
**Last Updated**: November 21, 2025

---

## New Architecture Overview

### Naming Convention
- D1: `portfolio-sql-{env}` (not `portfolio-{env}`)
- Vectorize: `portfolio-embeddings-{env}`
- Queue: `portfolio-doc-processing-{env}`
- R2: `portfolio-documents-{env}` (per-environment buckets)

### Environments
- **staging**: Pre-production testing
- **production**: Live production
- **Local development**: Uses wrangler's local R2/D1 storage

### Why Per-Environment R2 Buckets?
R2 event notifications have a 1:1:1 mapping: **R2 bucket → Queue → Worker**. This means each environment needs its own R2 bucket to trigger its own queue and worker.

---

## Required Cloudflare API Token

Before running any commands, ensure you have a Cloudflare API token with these permissions:

**Token Permissions Required**:
- Account > D1 > Edit
- Account > Vectorize > Edit
- Account > R2 > Edit
- Account > Workers > Edit
- Account > Queue > Edit

**Create Token**: https://dash.cloudflare.com/profile/api-tokens

**Set in .dev.vars**:
```bash
# apps/document-processor/.dev.vars
CLOUDFLARE_API_TOKEN=your-token-here
CLOUDFLARE_ACCOUNT_ID=70e742defbfbc3bbf6228e06626c7766
OPENAI_API_KEY=sk-your-key-here
```

**Or use wrangler login**:
```bash
wrangler login
```

---

## Resource Status Check

### Check Existing Resources

```bash
# D1 Databases
wrangler d1 list

# Vectorize Indexes
wrangler vectorize list

# R2 Buckets
wrangler r2 bucket list

# Queues
wrangler queues list
```

---

## Current Resources (Actual)

### Active Resources
```
D1:
  - portfolio-sql-staging (b287f8a6-1760-4092-8f2f-3f3f453cfe4f)
  - portfolio-sql-prod (e8ae40da-e089-47f8-8845-7586f7a555ec)

Vectorize:
  - portfolio-embeddings-staging
  - portfolio-embeddings-prod

R2:
  - portfolio-documents-staging (staging environment)
  - portfolio-documents-prod (production environment)

Queues:
  - portfolio-doc-processing-staging
  - portfolio-doc-processing-staging-dlq
  - portfolio-doc-processing-prod
  - portfolio-doc-processing-prod-dlq
```

### Legacy Resources (Can be deleted)
```
R2:
  - portfolio-documents-dev (not in use)
  - portfolio-documents (old shared bucket, migrate data if needed)
```

---

## Cleanup Tasks

### Delete Legacy R2 Buckets

The following R2 buckets are no longer needed:

```bash
# Check if old shared bucket has data to migrate
wrangler r2 object list portfolio-documents
wrangler r2 object list portfolio-documents-dev

# Migrate data from old shared bucket to staging (if needed)
# Then delete legacy buckets:
wrangler r2 bucket delete portfolio-documents-dev
wrangler r2 bucket delete portfolio-documents  # old shared bucket
```

---

## Local Development Setup

### Local-First Development

When running `wrangler dev`:
- ✅ D1: Local SQLite (ephemeral, fast)
- ✅ R2: Local storage (wrangler's `.wrangler/state/` directory)
- ☁️ Vectorize: Remote staging (portfolio-embeddings-staging)
- ☁️ Queue: Local queue (portfolio-doc-processing-local)

### Setup Steps

1. **Get API Token** and add to `.dev.vars`
2. **Apply migrations to local D1**:
   ```bash
   pnpm db:migrate:local apps/database/migrations/0001_initial_schema.sql
   ```
3. **Start dev server**:
   ```bash
   cd apps/document-processor
   pnpm dev
   ```

---

## Current Resource Tracking

See `plan/cloudflare-migration/phase-1-resources.json` for the most up-to-date resource IDs.

Current active resources:
- D1: `portfolio-sql-staging`, `portfolio-sql-prod`
- Vectorize: `portfolio-embeddings-staging`, `portfolio-embeddings-prod`
- R2: `portfolio-documents-staging`, `portfolio-documents-prod`
- Queues: staging/prod with DLQ variants

---

## Required Environment Variables

### For Local Development (.dev.vars)

```bash
# apps/document-processor/.dev.vars
CLOUDFLARE_API_TOKEN=your-token-with-full-permissions
CLOUDFLARE_ACCOUNT_ID=70e742defbfbc3bbf6228e06626c7766
OPENAI_API_KEY=sk-your-openai-key
ENVIRONMENT=local
```

### For CI/CD (GitHub Secrets)

```
CLOUDFLARE_API_TOKEN (with full permissions)
CLOUDFLARE_ACCOUNT_ID
OPENAI_API_KEY (staging and prod - separate keys recommended)
```

---

## FAQ

**Q: Why only 2 environments instead of 3?**
**A**: Simplified architecture. Local dev uses local D1 + remote staging resources. No need for a separate "dev" environment in the cloud.

**Q: Why per-environment R2 buckets?**
**A**: R2 event notifications have a 1:1:1 mapping (bucket → queue → worker). Each environment needs its own bucket to trigger its own processing pipeline.

**Q: Can we rename existing D1 databases?**
**A**: No, D1 doesn't support renaming. We created new databases with correct names.

**Q: How does local development work?**
**A**: `wrangler dev` uses local D1 and R2 storage (in `.wrangler/state/`), remote Vectorize (staging), and local queue. Use `sync-experiments.sh` to populate local R2 with test data.
