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

```bash
# Build the container image defined in ./Dockerfile
docker build -t container-proto .

# Optionally supply OPENAI_API_KEY so the service can call OpenAI
cat <<'EOF' > .env.container
OPENAI_API_KEY=sk-...
EOF

# Start the FastAPI server on http://localhost:8000
docker run --rm \
  --env-file .env.container \
  -p 8000:8000 \
  container-proto
```

> Omit `--env-file .env.container` if you want to rely solely on the deterministic fallback jokes.

Smoke-test the endpoints directly:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/joke \
  -H "content-type: application/json" \
  -d '{"topic": "workers", "audience": "cloudflare"}'
```

### 2. Run the Worker against a remote development container

Cloudflare Containers always execute in Cloudflare's infrastructure, so `wrangler dev` still builds and uploads the Docker image before proxying requests locally. Run the Worker from the repository root:

```bash
cd apps/container-proto
pnpm wrangler dev --remote
```

Endpoints exposed by the Worker:

- `GET /` – Lists the available prototype routes.
- `GET /api/health` – Proxies to the FastAPI `/health` endpoint.
- `GET /api/joke?topic=fastapi&audience=backend` – Requests a joke via POST `/joke` in the container.
- `GET /schema/joke-request` – Returns the canonical JSON Schema for request bodies.
- `GET /schema/joke-response` – Returns the canonical JSON Schema for responses.

The Worker validates container responses with the shared schema via `@cfworker/json-schema`. The FastAPI service validates incoming and outgoing payloads with `jsonschema` using the same files.

## Deploying from your workstation

Before deploying, supply the Cloudflare account ID and configure secrets. Wrangler picks up the `CLOUDFLARE_ACCOUNT_ID` automatically when it is defined via `wrangler config`, the `CLOUDFLARE_ACCOUNT_ID` environment variable, or `wrangler.jsonc`.

```bash
cd apps/container-proto
export CLOUDFLARE_ACCOUNT_ID="<your-account-id>"
pnpm wrangler secret put OPENAI_API_KEY
pnpm wrangler deploy
```

The deployment flow matches the [Cloudflare documentation](https://developers.cloudflare.com/containers/get-started/): Wrangler builds the Docker image, uploads it to the Cloudflare registry, deploys the Worker, and provisions the Durable Object-backed container instances.

## Continuous deployment with GitHub Actions

The repository includes `.github/workflows/container-proto-deploy.yml`, which performs the following whenever changes land on `main` under `apps/container-proto/` (or when triggered manually):

1. Install Node 22.x and pnpm.
2. Install workspace dependencies and run lint/type-check tasks for `@portfolio/container-proto`.
3. Invoke `wrangler deploy` through the official `cloudflare/wrangler-action`, which builds the Docker image and publishes the Worker + container bundle.

To activate the workflow, configure the required repository secrets:

- `CLOUDFLARE_API_TOKEN` – API token with `Workers Scripts:Edit` and `Account.Cloudflare Workers` permissions (the "Edit Cloudflare Workers" template satisfies both and enables Container deployments).
- `CLOUDFLARE_ACCOUNT_ID` – Account identifier shown on the Cloudflare dashboard.
- `OPENAI_API_KEY` – Optional, passed to the container so the FastAPI service can call OpenAI; omit it if you prefer the deterministic fallback jokes.

Once the secrets exist, the workflow automatically deploys on pushes to `main` or can be invoked manually from the "Actions" tab via "Run workflow".

## Schema sharing notes

- `schema/*.json` files are the single source of truth for request/response payloads.
- The Worker imports these JSON files directly and derives TypeScript types using `json-schema-to-ts`, enabling compile-time safety and runtime validation.
- The FastAPI service reads the same JSON files at startup, validates requests/responses with `jsonschema`, and raises HTTP 500 errors if a payload ever diverges from the shared contract.

Updating the schema automatically keeps both sides in sync—change the JSON file, run tests, and redeploy. Consider adding automated tests or scripts to regenerate typed bindings if the schema grows.
