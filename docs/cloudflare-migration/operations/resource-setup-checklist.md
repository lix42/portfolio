# Cloudflare Resource Setup Checklist

**Current Status**: Resources were created in Phase 1 with old naming convention.
**Action Required**: Rename/recreate resources to match new architecture.

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
- **No dev environment** - local development uses staging resources remotely

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

## Migration Plan: Old → New Resources

### Current Resources (Phase 1)
```
D1:
  - portfolio-dev (467f540e-2d86-461e-b9fb-98c80a736ec5)
  - portfolio-staging (f87dc2f0-b2c3-4179-a0e9-f10beb004cdb)
  - portfolio-prod (7862c8d9-7982-4ac5-981d-8371b7b8cc3f)

Vectorize:
  - portfolio-embeddings-dev
  - portfolio-embeddings-staging
  - portfolio-embeddings-prod

R2:
  - portfolio-documents-dev
  - portfolio-documents-staging
  - portfolio-documents-prod

Queues:
  - portfolio-doc-processing-dev
  - portfolio-doc-processing-staging
  - portfolio-doc-processing-prod
```

### Target Resources (New Architecture)
```
D1:
  - portfolio-sql-staging
  - portfolio-sql-prod

Vectorize:
  - portfolio-embeddings-staging
  - portfolio-embeddings-prod

R2:
  - portfolio-documents (shared)

Queues:
  - portfolio-doc-processing-staging
  - portfolio-doc-processing-prod
```

---

## Option 1: Keep and Repurpose Existing Resources (Recommended)

**Pros**: No data migration needed, just update configs
**Cons**: Resource names don't match convention (but IDs stay the same)

### Actions:
1. **D1**: Keep existing databases, just update `database_name` references in code
2. **Vectorize**: Keep existing indexes (names are fine)
3. **R2**: Consolidate to `portfolio-documents-staging` as shared bucket
4. **Queues**: Keep existing queues (names are fine)
5. **Delete -dev resources** when ready

### Update wrangler.jsonc

```jsonc
{
  // Use existing staging database as "portfolio-sql-staging"
  "d1_databases": [{
    "binding": "DB",
    "database_name": "portfolio-staging",  // Keep old name
    "database_id": "f87dc2f0-b2c3-4179-a0e9-f10beb004cdb"
  }],

  "r2_buckets": [{
    "binding": "DOCUMENTS_BUCKET",
    "bucket_name": "portfolio-documents-staging"  // Use as shared
  }]
}
```

---

## Option 2: Create New Resources with Correct Names (Clean Slate)

**Pros**: Perfect naming, fresh start
**Cons**: Need to migrate data from old resources

### Step 1: Create D1 Databases

```bash
# Create staging SQL database
wrangler d1 create portfolio-sql-staging

# Create production SQL database
wrangler d1 create portfolio-sql-prod

# Note the database_id from each output
```

**Expected Output**:
```
✅ Successfully created DB 'portfolio-sql-staging' in region WNAM

[[d1_databases]]
binding = "DB"
database_name = "portfolio-sql-staging"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Step 2: Apply Schema to New Databases

```bash
# Staging
wrangler d1 execute portfolio-sql-staging \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql

# Production
wrangler d1 execute portfolio-sql-prod \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql
```

### Step 3: Create Vectorize Indexes (if needed)

The existing names are fine, but if you want to recreate:

```bash
# Staging
wrangler vectorize create portfolio-embeddings-staging \
  --dimensions=1536 \
  --metric=cosine

# Production
wrangler vectorize create portfolio-embeddings-prod \
  --dimensions=1536 \
  --metric=cosine
```

### Step 4: Create/Consolidate R2 Bucket

**Option A**: Use existing bucket
```bash
# Rename existing bucket (if supported) or just use portfolio-documents-staging
# as the shared bucket
```

**Option B**: Create new shared bucket
```bash
# Create shared bucket
wrangler r2 bucket create portfolio-documents

# Migrate data from old buckets
wrangler r2 object copy portfolio-documents-staging/* portfolio-documents/
```

### Step 5: Create Queues (if needed)

Existing queue names are fine:

```bash
# Only if creating new queues
wrangler queues create portfolio-doc-processing-staging
wrangler queues create portfolio-doc-processing-staging-dlq

wrangler queues create portfolio-doc-processing-prod
wrangler queues create portfolio-doc-processing-prod-dlq
```

### Step 6: Migrate Data (if using Option 2)

```bash
# Export from old database
wrangler d1 export portfolio-staging > backup-staging.sql

# Import to new database
wrangler d1 execute portfolio-sql-staging --file=backup-staging.sql

# Repeat for production
wrangler d1 export portfolio-prod > backup-prod.sql
wrangler d1 execute portfolio-sql-prod --file=backup-prod.sql
```

### Step 7: Delete Old -dev Resources

```bash
# Delete dev database
wrangler d1 delete portfolio-dev

# Delete dev Vectorize index
wrangler vectorize delete portfolio-embeddings-dev

# Delete dev R2 bucket (must be empty first)
wrangler r2 bucket delete portfolio-documents-dev

# Delete dev queues
wrangler queues delete portfolio-doc-processing-dev
wrangler queues delete portfolio-doc-processing-dev-dlq
```

---

## Recommended Approach

**For Now (Quick Start)**:
1. Use **Option 1** - keep existing resources
2. Update wrangler.jsonc to use existing IDs
3. Use `portfolio-documents-staging` as shared R2 bucket
4. Add alias comments in config explaining name mismatch

**Future (When Ready)**:
1. Create new `portfolio-sql-staging` and `portfolio-sql-prod` databases
2. Migrate data during low-traffic period
3. Update all configs to new database IDs
4. Delete old resources

---

## Local Development Setup

### Confirm: Yes, use staging resources for local dev

When running `wrangler dev`:
- ✅ D1: Local SQLite (ephemeral, fast)
- ☁️ R2: Remote staging bucket (portfolio-documents-staging or portfolio-documents)
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

## Updated Resource Tracking

Update `phase-1-resources.json` after changes:

```json
{
  "updated": "2025-11-16",
  "architecture": "Two environments (staging + prod), shared R2 bucket",
  "d1_databases": {
    "staging": {
      "logical_name": "portfolio-sql-staging",
      "actual_name": "portfolio-staging",
      "database_id": "f87dc2f0-b2c3-4179-a0e9-f10beb004cdb",
      "region": "WNAM"
    },
    "prod": {
      "logical_name": "portfolio-sql-prod",
      "actual_name": "portfolio-prod",
      "database_id": "7862c8d9-7982-4ac5-981d-8371b7b8cc3f",
      "region": "WNAM"
    }
  },
  "vectorize_indexes": {
    "staging": "portfolio-embeddings-staging",
    "prod": "portfolio-embeddings-prod"
  },
  "r2_buckets": {
    "shared": "portfolio-documents-staging"
  },
  "queues": {
    "staging": "portfolio-doc-processing-staging",
    "staging_dlq": "portfolio-doc-processing-staging-dlq",
    "prod": "portfolio-doc-processing-prod",
    "prod_dlq": "portfolio-doc-processing-prod-dlq"
  }
}
```

---

## Next Steps

1. **Immediate**: Choose Option 1 or 2
2. **If Option 1**: Update all wrangler.jsonc files to use existing resource IDs
3. **If Option 2**: Run create commands, migrate data, update configs
4. **Test**: Run local dev with `pnpm dev` and verify connection to staging resources
5. **Deploy**: Deploy to staging and verify

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

## Questions to Answer

**Q: Which option should we use?**
**A**: Option 1 for now (use existing resources), Option 2 later for perfect naming

**Q: What about the naming mismatch?**
**A**: We can live with `portfolio-staging` instead of `portfolio-sql-staging`. The important part is the architecture (2 envs, shared R2).

**Q: Can we rename existing D1 databases?**
**A**: No, D1 doesn't support renaming. Need to create new and migrate.

**Q: Will local dev work with staging resources?**
**A**: Yes! `wrangler dev` uses local D1 but remote R2/Vectorize/Queue by default.
