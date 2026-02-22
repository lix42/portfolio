# Document Processor

Event-driven document ingestion pipeline on Cloudflare Workers. Triggered by R2 upload events via Queues; uses Durable Objects as a state machine to stay within Worker CPU/memory limits.

## Architecture

```
R2 (.md upload) → Queue → Worker → Durable Object State Machine
                                         ↓
                               1. Download & chunk
                               2. Generate embeddings (batched, 10 chunks)
                               3. Generate tags (batched, 5 chunks)
                               4. Store to D1 + Vectorize
```

Each document gets its own Durable Object instance. Processing steps run as separate invocations via alarms, bypassing the 30s CPU limit, 50-subrequest limit, and 128MB memory limit of a single Worker invocation.

## Commands

```bash
# Local dev server
pnpm dev

# Tests
pnpm test
pnpm test:watch

# Type checking
pnpm typecheck

# Deploy to staging (default)
pnpm deploy

# Deploy to production
pnpm deploy:prod

# Tail logs
pnpm tail:staging
pnpm tail:prod
```

## API Endpoints

All endpoints available at `http://localhost:8787` locally or `https://portfolio-document-processor-staging.i-70e.workers.dev` on staging.

```bash
# Health check
GET /health

# Trigger processing for an R2 key
POST /process
{"r2Key": "experiments/webforms.md"}

# Check processing status
GET /status?r2Key=experiments/webforms.md

# Resume a failed/stuck job
POST /resume
{"r2Key": "experiments/webforms.md"}

# Reprocess (cleans existing data and restarts)
POST /reprocess
{"r2Key": "experiments/webforms.md"}

# List all R2 keys (debug)
GET /r2-keys
```

## Environment Variables

Required in `.dev.vars` (local) and Cloudflare secrets (production):

- `OPENAI_API_KEY`: For embeddings and tag generation

Cloudflare bindings (in `wrangler.jsonc`):

| Environment | D1 | R2 Bucket | Vectorize | Queue |
|-------------|-----|-----------|-----------|-------|
| Local | `portfolio-sql-staging` (remote) | local storage | `portfolio-embeddings-staging` | `portfolio-doc-processing-local` |
| Staging | `portfolio-sql-staging` | `portfolio-documents-staging` | `portfolio-embeddings-staging` | `portfolio-doc-processing-staging` |
| Production | `portfolio-sql-prod` | `portfolio-documents-prod` | `portfolio-embeddings-prod` | `portfolio-doc-processing-prod` |

## Gotchas

- **Processing stuck?** Check `/status` then use `/resume`. If it's corrupted, use `/reprocess` (destructive — wipes existing chunks/embeddings for that document).
- **R2 object not found locally**: Run `./sync-experiments.sh` to pull test documents.
- **Local dev uses remote D1** for staging data — local D1 support for Queue consumers is limited.
- See `LOCAL_DEVELOPMENT.md` for detailed local setup.
