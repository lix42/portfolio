# Portfolio Service API

A Hono-based TypeScript API service deployed on Cloudflare Workers that provides RAG (Retrieval-Augmented Generation) functionality for querying work experience and portfolio information.

## Architecture

- **Framework**: Hono (lightweight web framework for edge computing)
- **Runtime**: Cloudflare Workers
- **Database**: Supabase with pgvector for vector similarity search
- **AI**: OpenAI API for embeddings and chat completions

## Key Features

- Vector similarity search for relevant document chunks
- Streaming chat responses using OpenAI
- CORS-enabled API endpoints
- Environment-based configuration (local/remote Supabase)

## Development

```bash
# Start development server with hot reload
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm type-check

# Deploy to Cloudflare Workers
pnpm deploy

# Generate Cloudflare bindings types
pnpm cf-typegen
```

## Local Smoking test

```shell
pnpm dev # start the server

# test the API
curl --request POST \
  --url http://localhost:5173/v1/chat \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.2.0' \
  --data '{
	"message": "Tell me an example about how you cooperate with other people."
}'
```

## Environment Variables

Required in `.dev.vars` (local) and Cloudflare Workers secrets (production):

- `OPENAI_API_KEY`: OpenAI API key for embeddings and chat
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

## API Endpoints

- `GET /`: Health check
- `POST /chat`: RAG chat endpoint (accepts `{ message: string }`, returns streaming response)

## Configuration

- `wrangler.jsonc`: Cloudflare Workers configuration with bindings
- `vitest.config.ts`: Test configuration with Cloudflare Workers environment
- Type definitions in `worker-configuration.d.ts`

## Code Conventions

- Use named exports
- Kebab-case for file names
- camelCase for variables/functions
- PascalCase for types/interfaces
- Prefix generic types with `T`
