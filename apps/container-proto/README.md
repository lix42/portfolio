# Cloudflare Container + FastAPI Prototype

This prototype follows the [Cloudflare Containers getting started guide](https://developers.cloudflare.com/containers/get-started/) and adapts it to a Python/FastAPI service. The Worker proxies to a containerised FastAPI app that can either forward OpenAI-powered jokes or fall back to deterministic ones. Both sides share JSON Schemas for their request/response payloads.

## Repository layout

```
apps/container-proto/
├── Dockerfile                # Image built and pushed by `wrangler`
├── README.md                 # This file
├── container/                # Python sources
│   ├── app/main.py           # FastAPI app
│   └── requirements.txt      # Python dependencies
├── package.json              # Worker package manifest
├── schema/                   # Canonical JSON Schemas shared by Worker & FastAPI
│   ├── joke-request.schema.json
│   └── joke-response.schema.json
├── src/worker.ts             # Cloudflare Worker + Durable Object container orchestration
├── tsconfig.json             # TypeScript configuration for the Worker
├── worker-configuration.d.ts # Strongly typed bindings for Wrangler type generation
└── wrangler.jsonc            # Wrangler + container configuration
```

## Prerequisites

- Docker running locally (required when running `wrangler deploy` so the container image can be built).
- Cloudflare CLI (`wrangler`) authenticated with your account (`wrangler login` or `wrangler config`).
- `pnpm` installed (the repository is a pnpm workspace).

## Installing dependencies

```bash
pnpm install
```

This installs Worker dependencies and makes the shared schemas importable from TypeScript.

## Local iteration

### 1. Exercise the FastAPI container with Docker

You can build and run the Python service by itself to validate the schema logic and the OpenAI fallback path without touching Cloudflare. From `apps/container-proto/`:

#### Setup environment (optional)

To test with OpenAI integration, create a `.env.container` file:

```bash
# Copy the example file and add your OpenAI API key
cp .env.container.example .env.container
# Edit .env.container and replace sk-your-key-here with your actual key
```

> **Note:** `.env.container` is gitignored. The `.env.container.example` file serves as a template.

#### Build and run the container

```bash
# Build the container image
docker build -t container-proto .

# Start the FastAPI server on http://localhost:8000
# With OpenAI key:
docker run --rm --env-file .env.container -p 8000:8000 container-proto

# Or without OpenAI key (uses fallback jokes):
docker run --rm -p 8000:8000 container-proto
```

#### Test the endpoints

```bash
# Health check
curl http://localhost:8000/health

# Test root metadata
curl http://localhost:8000/

# Generate a joke (with or without OpenAI, depending on setup)
curl -X POST http://localhost:8000/joke \
  -H "content-type: application/json" \
  -d '{"topic": "containers", "audience": "devops engineers"}'

# Minimal request
curl -X POST http://localhost:8000/joke \
  -H "content-type: application/json" \
  -d '{}'
```

Expected responses:
- With OpenAI configured: `{"id":"...","message":"<generated joke>","source":"openai"}`
- Without OpenAI or on API error: `{"id":"...","message":"<fallback joke>","source":"fallback"}`

### 2. Test the Worker with wrangler dev

#### Option A: Remote mode (Worker only)

Test the Worker code without container invocation:

```bash
cd apps/container-proto
pnpm wrangler dev --remote
```

This mode supports:
- ✅ `GET /` – Lists available routes
- ✅ `GET /schema/joke-request` – Returns the request schema
- ✅ `GET /schema/joke-response` – Returns the response schema
- ❌ `GET /api/health`, `GET /api/joke` – Container endpoints not available (containers not supported in remote mode)

#### Option B: Local mode (Worker + Container)

> **⚠️ Known Limitation:** Local container development has timeout issues. Container startup takes longer than the Durable Object `blockConcurrencyWhile()` limit, causing "Container invocation failed" errors. **For full Worker + Container integration testing, deploy to Cloudflare instead.**

```bash
cd apps/container-proto
pnpm wrangler dev  # without --remote flag
```

This builds the container locally but may timeout on container invocations.

#### Recommended testing workflow

1. **Container logic**: Test directly with Docker (see section 1)
2. **Worker endpoints**: Test with `wrangler dev --remote`
3. **Full integration**: Deploy to Cloudflare (see deployment section below)

The Worker validates container responses with the shared schema via `@cfworker/json-schema`. The FastAPI service validates incoming and outgoing payloads with `jsonschema` using the same files.

## Deploying from your workstation

### Step 1: Authenticate with Cloudflare

```bash
cd apps/container-proto
pnpm wrangler login
```

This opens a browser window for OAuth authentication. Once authenticated, wrangler stores your credentials locally.

### Step 2: Configure the OpenAI API key secret

```bash
pnpm wrangler secret put OPENAI_API_KEY
```

When prompted, paste your OpenAI API key. This stores the secret securely in Cloudflare's infrastructure.

> **Note:** The secret is **not** stored in `wrangler.jsonc` or environment variables. It's managed separately by Cloudflare and automatically injected into the Worker at runtime via `import { env } from 'cloudflare:workers'`.

### Step 3: Deploy

```bash
pnpm wrangler deploy
```

The deployment flow:
1. Wrangler builds the Docker image locally
2. Pushes the image to Cloudflare's container registry
3. Deploys the Worker code
4. Provisions Durable Object-backed container instances

After deployment completes, wrangler displays the Worker URL (e.g., `https://container-proto.{subdomain}.workers.dev`).

### Step 4: Verify the deployment

Test the deployed endpoints:

```bash
# Replace with your actual Worker URL
WORKER_URL="https://container-proto.{subdomain}.workers.dev"

# 1. Check the worker is responding
curl $WORKER_URL/

# 2. Verify the container received the OPENAI_API_KEY
curl $WORKER_URL/api/debug/env

# Expected response with OpenAI configured:
# {"version":"1","has_openai_key":true,"openai_key_length":164,"openai_key_prefix":"sk-proj"}

# 3. Test OpenAI joke generation
curl -X POST $WORKER_URL/api/joke \
  -H "content-type: application/json" \
  -d '{"topic": "cloudflare containers", "audience": "developers"}'

# Expected response:
# {"id":"...","message":"<AI-generated joke>","source":"openai"}

# 4. Check container health
curl $WORKER_URL/api/health
```

If the `/api/debug/env` endpoint shows `"has_openai_key": false`, the secret may not have been set correctly. Re-run `pnpm wrangler secret put OPENAI_API_KEY` and redeploy.

### Viewing logs

With observability enabled in `wrangler.jsonc`, you can tail live logs:

```bash
pnpm wrangler tail container-proto
```

This shows both Worker logs and container logs in real-time.

## Continuous deployment with GitHub Actions

The repository includes `.github/workflows/container-proto-deploy.yml`, which automatically deploys the container prototype whenever changes are pushed to `main` under `apps/container-proto/` (or when triggered manually).

### Workflow steps

1. **Set up environment** – Install Node 22.x and pnpm
2. **Install dependencies** – Run `pnpm install --frozen-lockfile`
3. **Lint** – Check Worker TypeScript code with `pnpm lint`
4. **Type-check** – Verify TypeScript types with `pnpm typecheck`
5. **Configure secret** – Set `OPENAI_API_KEY` in Cloudflare using `wrangler secret put`
6. **Deploy** – Build Docker image, push to Cloudflare registry, and deploy Worker + container

### Required repository secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `CLOUDFLARE_API_TOKEN` | API token with Workers permissions | Create in [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) using the "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Found in the Cloudflare Dashboard URL or account settings |
| `OPENAI_API_KEY` | OpenAI API key for joke generation | Get from [OpenAI Platform](https://platform.openai.com/api-keys) (optional - uses fallback jokes if not provided) |

### Triggering deployments

- **Automatic**: Push changes to `main` branch under `apps/container-proto/` or `.github/workflows/container-proto-deploy.yml`
- **Manual**: Go to Actions tab → "Deploy container prototype" → "Run workflow" → Select `main` branch → Click "Run workflow"

### Verifying deployments

After the workflow completes, verify the deployment using the steps in the [Verify the deployment](#step-4-verify-the-deployment) section above.

## Schema sharing notes

- `schema/*.json` files are the single source of truth for request/response payloads.
- The Worker imports these JSON files directly and derives TypeScript types using `json-schema-to-ts`, enabling compile-time safety and runtime validation.
- The FastAPI service reads the same JSON files at startup, validates requests/responses with `jsonschema`, and raises HTTP 500 errors if a payload ever diverges from the shared contract.

Updating the schema automatically keeps both sides in sync—change the JSON file, run tests, and redeploy. Consider adding automated tests or scripts to regenerate typed bindings if the schema grows.
