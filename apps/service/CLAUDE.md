# Portfolio Service API

A Hono-based TypeScript API service deployed on Cloudflare Workers that provides
RAG (Retrieval-Augmented Generation) functionality for querying work experience
and portfolio information.

## Architecture

- **Framework**: Hono (lightweight web framework for edge computing)
- **Runtime**: Cloudflare Workers
- **Storage**: Cloudflare native services
  - **D1**: SQLite database for metadata and tag filtering
  - **Vectorize**: Vector search for semantic similarity
  - **R2**: Object storage for document content
- **AI**: OpenAI API for embeddings and chat completions

### Query Strategy

Hybrid RAG approach combining tag-based and vector similarity search:
1. Tag-based filtering via D1 (indexed lookups)
2. Vector similarity search via Vectorize
3. Hybrid scoring and ranking
4. Document retrieval from R2

## Key Features

- Vector similarity search for relevant document chunks
- Streaming chat responses using OpenAI
- CORS-enabled API endpoints

## Development

```bash
# Start development server with hot reload (using wrangler)
pnpm dev

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Deploy to Cloudflare Workers (staging by default)
pnpm deploy

# Deploy to production
pnpm deploy:prod

# Generate Cloudflare bindings types (local only)
pnpm cf-typegen
```

## Local Smoking test

```shell
pnpm dev # start the server

# test the API
curl --request POST \
  --url http://localhost:5000/v1/chat \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.2.0' \
  --data '{
  "message": "Tell me an example about how you cooperate with other people."
}'

# View interactive API docs
open http://localhost:5000/scalar
```

## Environment Variables

Required in `.dev.vars` (local) and Cloudflare Workers secrets (production):

- `OPENAI_API_KEY`: OpenAI API key for embeddings and chat completions

## API Endpoints

- `GET /v1/health`: Health check (returns version + status)
- `POST /v1/chat`: RAG chat (accepts `{ message: string }`, returns JSON answer)
- `POST /v1/chat/sse`: Streaming chat via SSE (same input, streams response)
- `GET /openapi.json`: OpenAPI spec
- `GET /scalar`: Interactive API docs UI (Scalar)

## Service Binding

The service exports a `WorkerEntrypoint` (`ChatServiceBinding`) consumed by `apps/ui` via Cloudflare service binding. The binding exposes `health()` and `chat(message)` methods for direct Worker-to-Worker calls without HTTP overhead.

## Configuration

- `wrangler.jsonc`: Cloudflare Workers configuration (uses direct TypeScript execution)
- `vitest.config.ts`: Test configuration with Cloudflare Workers environment
- Type definitions in `worker-configuration.d.ts`

**Note:** This service uses the `cloudflare-worker` template (not `cloudflare-worker+vite`). Development and deployment use wrangler directly without a Vite build step.

## Build & Deployment

The service uses wrangler for both development and deployment:

- **Build command** (`pnpm build`) generates type artifacts via `tsc --project tsconfig.type.json`
- **Type checking** uses `pnpm typecheck` (`tsc --noEmit`)
- **Deployment** uses `wrangler deploy --minify` with staging as the default env

### Build Verification

Run `pnpm build` to generate type artifacts without deploying.

## Code Conventions

- Use named exports
- Kebab-case for file names
- camelCase for variables/functions
- PascalCase for types/interfaces
- Prefix generic types with `T`
