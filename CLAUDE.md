# CLAUDE.md

## Rules

### Use verified docs, not memory
For any framework or library, always fetch current docs via Context7 rather than relying on training data.

### Think critically
Don’t rubber-stamp plans or reasoning — push back with a short explanation when something seems off.

### Plan before acting
For meaningful changes (not typos/formatting), propose what you’ll change and why first. Follow the plan once agreed.

### Code organization
Pure functions over classes — use classes only when required (Durable Objects, framework APIs).
- `types.ts` — type definitions
- `utils.ts` / `utils/` — pure utility functions
- Feature folders (e.g., `steps/`) for domain logic
- Classes contain minimal orchestration only

## Project Overview

Turborepo monorepo using pnpm workspaces.

**Apps:**
- `apps/service` — Hono API on Cloudflare Workers (RAG backend)
- `apps/ui` — TanStack Start (React) frontend on Cloudflare Workers
- `apps/document-processor` — Event-driven document ingestion (R2 → Queue → Durable Object → D1/Vectorize)
- `apps/database` — D1 migration SQL files (not a workspace package)
- `apps/r2-sync` — CLI to sync local documents to R2
- `apps/r2-reconciliation` — R2 reconciliation tool
- `apps/container-proto` — PoC: Worker + containerised FastAPI

**Packages:**
- `packages/shared` — Shared schemas, types, prompts, utilities

## Commands

```bash
# Development (full stack — ui depends on service, both start)
pnpm dev

# Development (service only)
pnpm dev:service

# Run all tests
pnpm test

# Lint (Biome)
pnpm lint
pnpm lint:fix

# Type checking (all packages)
pnpm typecheck

# Build all
pnpm build

# Deploy (staging / production)
pnpm deploy
pnpm deploy:prod

# Storybook (component explorer)
pnpm storybook

# Sync documents to R2
pnpm sync:r2 -- --env staging
```

## CI/CD & Document Pipeline

**Branches:** `main` → staging, `prod` → production

**On push to `main`/`prod` with `documents/**` changes:**
1. `sync-documents.yml` — syncs `documents/` to R2 (key = path relative to `documents/`, e.g. `experiments/webforms.md`)
2. `deploy-staging.yml` / `deploy-production.yml` — redeploys all workers (runs on any push, no path filter)
3. R2 upload triggers event notification → `portfolio-doc-processing-<env>` queue → document processor
4. `r2-reconciliation` runs daily at 2 AM UTC as a safety net

**Re-trigger sync manually (e.g. after fixing the workflow):**
```bash
gh workflow run sync-documents.yml --field environment=staging
```

**Gotchas:**
- `sync-documents.yml` runs `node apps/r2-sync/dist/cli.js` directly (not via turbo) — turbo doesn't pass GitHub Actions secrets to child processes
- `node apps/r2-sync/dist/cli.js` must be run from repo root with `--documents-path ./documents`
- PRs branched from feature branches may have zero net diff to `main` — sync workflow won't trigger if `documents/**` files are unchanged relative to main

**Monitoring:** Use `/monitor-docs <PR#>` skill to verify end-to-end processing after merge

**Cloudflare resources (staging):**
- Document processor: `https://portfolio-document-processor-staging.i-70e.workers.dev`
- D1 database ID: `b287f8a6-1760-4092-8f2f-3f3f453cfe4f`

**Cloudflare resources (production):**
- Document processor: `https://portfolio-document-processor-prod.i-70e.workers.dev`
- D1 database ID: `e8ae40da-e089-47f8-8845-7586f7a555ec`

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** TanStack Start, TanStack Router (file based), Tailwind CSS v4, Shadcn/UI with Base UI, TanStack Query
- **Backend:** Hono on Cloudflare Workers with D1 + Vectorize + R2 + OpenAI
