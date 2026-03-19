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

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** TanStack Start, TanStack Router (file based), Tailwind CSS v4, Shadcn/UI with Base UI, TanStack Query
- **Backend:** Hono on Cloudflare Workers with D1 + Vectorize + R2 + OpenAI
