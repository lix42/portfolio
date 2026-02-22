# Container Proto

Proof-of-concept: Cloudflare Worker + containerised Python/FastAPI service. The Worker proxies to the FastAPI container and shares JSON Schemas for request/response validation on both sides.

## Architecture

```
Client → Cloudflare Worker (TypeScript) → Durable Object → FastAPI Container (Python)
```

- **Worker** (`src/worker.ts`): Routes requests, validates responses against shared schemas via `@cfworker/json-schema`
- **Container** (`container/app/main.py`): FastAPI app that generates jokes via OpenAI or falls back to deterministic ones
- **Schemas** (`schema/`): Canonical JSON Schemas shared by both sides — single source of truth

## Commands

```bash
# Type checking
pnpm typecheck

# Generate Cloudflare bindings types
pnpm cf-typegen

# Local Worker only (no container)
pnpm wrangler dev --remote

# Local Worker + container (may timeout — see gotchas)
pnpm dev

# Deploy (requires Docker running)
pnpm deploy

# Tail live logs
pnpm wrangler tail container-proto
```

## Container (Docker)

```bash
# Build and run FastAPI locally
docker build -t container-proto .
docker run --rm -p 8000:8000 container-proto

# With OpenAI key
cp .env.container.example .env.container  # add OPENAI_API_KEY
docker run --rm --env-file .env.container -p 8000:8000 container-proto

# Test endpoints
curl http://localhost:8000/health
curl -X POST http://localhost:8000/joke \
  -H "content-type: application/json" \
  -d '{"topic": "containers", "audience": "devops engineers"}'
```

## API Endpoints (deployed Worker)

- `GET /` – Lists available routes
- `GET /schema/joke-request` – Request schema
- `GET /schema/joke-response` – Response schema
- `GET /api/health` – Container health (requires container)
- `POST /api/joke` – Generate joke (requires container)
- `GET /api/debug/env` – Verify `OPENAI_API_KEY` is set

## Environment Variables

- `OPENAI_API_KEY`: Worker secret (set via `pnpm wrangler secret put OPENAI_API_KEY`)
- `.env.container`: Local Docker only (gitignored; use `.env.container.example` as template)

## Gotchas

- **Local container dev times out**: Container startup exceeds Durable Object `blockConcurrencyWhile()` limit. Use Docker directly for FastAPI testing and `--remote` for Worker testing. Full integration requires deploying to Cloudflare.
- **Deployment requires Docker**: `wrangler deploy` builds and pushes the Docker image — Docker must be running locally.
- **Schema is the contract**: Both sides validate against `schema/*.json`. Changing a schema breaks both Worker and FastAPI simultaneously — always update both and redeploy together.
