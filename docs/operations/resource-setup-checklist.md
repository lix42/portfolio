# Cloudflare Resource Setup Checklist

**Current Status**: ✅ Resources created with correct naming convention (2-environment architecture)
**Last Updated**: November 18, 2025

---

## New Architecture Overview

### Naming Convention
- D1: `portfolio-sql-{env}` (not `portfolio-{env}`)
- Vectorize: `portfolio-embeddings-{env}`
- Queue: `portfolio-doc-processing-{env}`
- R2: `portfolio-documents` (single shared bucket, no environment suffix)

### Environments
- **staging**: Pre-production testing
- **production**: Live production
- **Local development**: Uses local D1 + remote staging resources

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
  - portfolio-documents (shared across all environments)

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
  - portfolio-documents-staging (not in use)
  - portfolio-documents-prod (not in use)
```

---

## Cleanup Tasks

### Delete Legacy R2 Buckets

The following R2 buckets are no longer needed since we use a single shared bucket:

```bash
# First, ensure they are empty or migrate data if needed
wrangler r2 object list portfolio-documents-dev
wrangler r2 object list portfolio-documents-staging
wrangler r2 object list portfolio-documents-prod

# If empty or after migrating data to portfolio-documents, delete them:
wrangler r2 bucket delete portfolio-documents-dev
wrangler r2 bucket delete portfolio-documents-staging
wrangler r2 bucket delete portfolio-documents-prod
```

---

## Local Development Setup

### Confirm: Yes, use staging resources for local dev

When running `wrangler dev`:
- ✅ D1: Local SQLite (ephemeral, fast)
- ☁️ R2: Remote bucket (portfolio-documents)
- ☁️ Vectorize: Remote staging (portfolio-embeddings-staging)
- ☁️ Queue: Remote staging (portfolio-doc-processing-staging)

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
- R2: `portfolio-documents` (shared)
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

**Q: Why a single shared R2 bucket?**
**A**: Simplifies management and reduces costs. Documents are the same across environments.

**Q: Can we rename existing D1 databases?**
**A**: No, D1 doesn't support renaming. We created new databases with correct names.

**Q: Will local dev work with staging resources?**
**A**: Yes! `wrangler dev` uses local D1 but remote R2/Vectorize/Queue by default.
