# Document Processor

Event-driven document ingestion pipeline using Cloudflare Durable Objects.

## Features

- Automated processing triggered by R2 events via Queues
- State machine-based processing stays within Worker CPU/memory limits
- Batched OpenAI API calls for embeddings and tags
- Strong consistency with Durable Objects
- Automatic retry with exponential backoff
- Real-time status tracking

## Architecture

```
R2 (.md upload) → Queue → Worker → Durable Object State Machine
                                          ↓
                                1. Download & Chunk
                                2. Generate Embeddings (batched)
                                3. Generate Tags (batched)
                                4. Store to D1 + Vectorize
```

### Processing Flow

Each document gets its own Durable Object instance that:
1. Downloads content from R2
2. Chunks markdown into ~800 token segments
3. Generates embeddings in batches of 10 chunks
4. Generates tags in batches of 5 chunks
5. Stores results to D1 (documents + chunks) and Vectorize (embeddings)

### Why Durable Objects?

Processing medium/large documents in a single Worker invocation would exceed:
- 30-second CPU time limit for queue consumers
- 50 subrequest limit per invocation
- 128MB memory limit for large documents

Durable Objects orchestrate a state machine where each step executes in a separate invocation via alarms.

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "ok": true,
  "service": "document-processor",
  "version": "1.0.0",
  "environment": "staging"
}
```

### Trigger Processing

```bash
POST /process
Content-Type: application/json

{"r2Key": "experiments/webforms.md"}
```

### Get Status

```bash
GET /status?r2Key=experiments/webforms.md
```

Response:
```json
{
  "status": "processing",
  "currentStep": "embeddings",
  "progress": {
    "totalChunks": 50,
    "processedChunks": 25,
    "percentage": 50
  },
  "errors": [],
  "timing": {
    "startedAt": "2025-11-12T10:00:00Z"
  }
}
```

### Resume Failed Processing

```bash
POST /resume
Content-Type: application/json

{"r2Key": "experiments/webforms.md"}
```

### Reprocess Document

Cleans up existing data and restarts processing:

```bash
POST /reprocess
Content-Type: application/json

{"r2Key": "experiments/webforms.md"}
```

### List R2 Keys (Debug)

```bash
GET /r2-keys
```

## Development

### Prerequisites

- Node.js 22+
- pnpm
- Cloudflare account with Workers, D1, R2, Vectorize, and Queues
- OpenAI API key

### Local Development

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for detailed setup instructions.

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars and add your OPENAI_API_KEY

# Start local dev server
pnpm dev

# Run tests
pnpm test
```

### Deployment

```bash
# Deploy to staging
pnpm deploy:staging

# Deploy to production
pnpm deploy:prod

# View logs
pnpm tail:staging
pnpm tail:prod
```

## Environment Configuration

| Environment | D1 Database | R2 Bucket | Vectorize | Queue |
|-------------|-------------|-----------|-----------|-------|
| Local | portfolio-sql-staging (remote) | local storage | portfolio-embeddings-staging | portfolio-doc-processing-local |
| Staging | portfolio-sql-staging | portfolio-documents-staging | portfolio-embeddings-staging | portfolio-doc-processing-staging |
| Production | portfolio-sql-prod | portfolio-documents-prod | portfolio-embeddings-prod | portfolio-doc-processing-prod |

## Monitoring

```bash
# Check processing status
curl "https://portfolio-document-processor-staging.i-70e.workers.dev/status?r2Key=path/to/document.md"

# View real-time logs
wrangler tail portfolio-document-processor-staging

# Check D1 for processed documents
wrangler d1 execute portfolio-sql-staging \
  --command "SELECT COUNT(*) FROM documents"
```

## Troubleshooting

### "OpenAI API key missing"

Ensure `.dev.vars` contains `OPENAI_API_KEY` for local dev, or set the secret:
```bash
wrangler secret put OPENAI_API_KEY --env staging
```

### "R2 object not found"

For local dev, sync test documents:
```bash
./sync-experiments.sh
```

### Processing stuck

Check status and resume if needed:
```bash
curl "http://localhost:8787/status?r2Key=document.md"
curl -X POST http://localhost:8787/resume -d '{"r2Key": "document.md"}'
```

### Max retries exceeded

Check logs for error details, then reprocess:
```bash
curl -X POST http://localhost:8787/reprocess -d '{"r2Key": "document.md"}'
```

## Related Documentation

- [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [Phase 4 Execution Plan](../../plan/cloudflare-migration/phase-4-execution-plan.md)
- [R2 Reconciliation Worker](../r2-reconciliation/README.md)
