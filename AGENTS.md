# Repository Guidelines

## Project Overview

Full-stack **RAG (Retrieval-Augmented Generation) portfolio assistant** — a chat interface that answers questions about professional experience using vector search and LLM generation.

**Architecture:** pnpm monorepo on Cloudflare Workers. The UI sends requests via Cloudflare Service Bindings to the backend, which runs a hybrid search pipeline (D1 tag matching + Vectorize semantic similarity) and streams answers via OpenAI.

**Key technologies:** Hono, TanStack Start (React 19), Cloudflare Workers (D1, R2, Vectorize, Service Bindings), OpenAI, Zod, Tailwind CSS v4, Biome, Turborepo.

## Project Structure & Module Organization

```
apps/
  service/          → @portfolio/service   — Hono API on CF Workers (RAG pipeline)
  ui/               → @portfolio/ui        — TanStack Start + React frontend on CF Workers
  document-processor/ → @portfolio/document-processor — CF Worker for document processing
  r2-reconciliation/  → @portfolio/r2-reconciliation  — CF Worker for R2 consistency checks
  r2-sync/          → @portfolio/r2-sync   — CLI tool to sync documents to R2
  container-proto/  → @portfolio/container-proto — CF Containers experiment

packages/
  shared/           → @portfolio/shared    — Shared schemas, constants, embeddings, chunking, prompts
  eslint-config/    — Shared ESLint presets (legacy, mostly unused — Biome is primary)
  env-config/       — Empty/placeholder

documents/          — RAG source data (JSON files synced to R2)
scripts/            — Python ingestion scripts + shell utilities
supabase/           — SQL schema and migrations (legacy vector DB, being replaced by D1+Vectorize)
research/           — Experimental TS scripts (not linted, not deployed)
```

### Service (`apps/service`)

Cloudflare Worker API with Hono. Core pipeline:

1. **Validate** — Zod schemas from `@portfolio/shared`
2. **Preprocess** — OpenAI structured output extracts tags + validates question relevance
3. **Embed** — OpenAI `text-embedding-3-small` (1536 dimensions)
4. **Hybrid search** — D1 tag-based lookup + Vectorize semantic similarity, weighted scoring (`EMBEDDING_SCORE_WEIGHT = 10`), merged and ranked top 5
5. **Generate** — OpenAI Responses API with retrieved context, streamed or non-streamed

**Data layer** (`src/adapters/`): D1 (SQL — chunks, documents, tags), R2 (full document content), Vectorize (vector similarity).

**API routes:** `GET /v1/health`, `POST /v1/chat`, `POST /v1/chat/sse` (streaming), `GET /openapi.json`, `GET /scalar` (API docs).

**Service binding:** Exports `WorkerEntrypoint` class implementing `ChatServiceBinding` for RPC from the UI worker.

### UI (`apps/ui`)

TanStack Start (React 19) on Cloudflare Workers. File-based routing via TanStack Router (auto-generates `routeTree.gen.ts`).

**Server state:** TanStack React Query with `createServerFn` RPCs that call the service worker via Cloudflare Service Bindings (`env.CHAT_SERVICE.fetch()`).

**Client state:** React `useState` + localStorage (theme only). No dedicated store library.

**Styling:** Tailwind CSS v4 + shadcn/ui components (Base UI primitives, base-nova style) + `class-variance-authority` for variants + Hugeicons.

**SSR:** `@tanstack/react-router-ssr-query` integration; loaders use `prefetchQuery`/`ensureQueryData` for server-side data fetching.

**Storybook:** v10, `@storybook/react-vite`, stories colocated as `*.stories.tsx` beside components. The Storybook Vite config strips `cloudflare` and `tanstack-start` plugins since they require Workers runtime.

### Shared (`packages/shared`)

Business-critical shared code consumed by service, UI, and scripts:
- **Schemas** — Zod v4 schemas for all API contracts (`ChatRequestSchema`, `ChatResponseSchema`, SSE events, health, sync)
- **Constants** — Model names (`gpt-4o`), embedding config, chunking params (`MAX_CHUNK_TOKENS=800`, `CHUNK_OVERLAP_TOKENS=100`), search config (`VECTOR_SEARCH_TOP_K=5`)
- **Functions** — `generateEmbedding()`, `chunkMarkdown()`, `generateTags()`, `mapLimit()` (concurrency), `cosineSimilarity()`

## Build, Test & Development Commands

**Prerequisites:** Node 22.x (see `.nvmrc`), pnpm 10.x (`corepack enable` to activate).

### Essential Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Bootstrap all workspaces |
| `pnpm dev` | Start UI dev server (port 3000) — chains: shared → service → ui |
| `pnpm build` | Build all packages (runs lint + typecheck first via Turbo) |
| `pnpm test` | Run all Vitest test suites |
| `pnpm lint` | Biome check (linting + formatting) |
| `pnpm lint:fix` | Biome auto-fix |
| `pnpm typecheck` | TypeScript type checking across all packages |
| `pnpm storybook` | Launch Storybook dev server (port 6006) |
| `pnpm cf-typegen` | Regenerate `worker-configuration.d.ts` files from `wrangler.jsonc` |

### Scoped Commands

Use Turbo filtering to target specific packages:

```bash
turbo run dev --filter @portfolio/service     # Service only
turbo run test --filter @portfolio/shared     # Shared tests only
turbo run build --filter @portfolio/ui        # UI build only
turbo run deploy --filter @portfolio/service  # Deploy service to staging
```

### Per-App Dev Servers

| App | Port | Command |
|-----|------|---------|
| UI | 3000 | `pnpm dev` (from root) |
| Service | 5000 | `cd apps/service && pnpm dev` (Wrangler, staging env) |
| Storybook | 6006 | `pnpm storybook` (from root) |

### Database Commands

```bash
pnpm db:migrate:local <file>      # Apply migration to local D1
pnpm db:migrate:staging <file>    # Apply migration to staging D1
pnpm db:migrate:prod <file>       # Apply migration to production D1
pnpm db:query:local "<sql>"       # Run SQL against local D1
pnpm db:query:staging "<sql>"     # Run SQL against staging D1
```

### Deployment

```bash
pnpm deploy        # Deploy all deployable apps to staging
pnpm deploy:prod   # Deploy all deployable apps to production
```

Deployed apps: `service`, `document-processor`, `r2-reconciliation`. UI deploys via Cloudflare Pages/Workers.

### Python Scripts (Data Ingestion)

```bash
pip install -r requirements.txt          # Install Python deps
python scripts/ingest_companies.py       # Ingest company data
python scripts/ingest_documents.py       # Ingest documents into vector DB
python scripts/generate_tags.py          # Generate tags for documents
python scripts/prune_documents.py        # Clean up old documents
python scripts/run_tests.py              # Run Python test suite
```

## Turbo Pipeline & Dependency Chain

The Turbo build graph enforces ordering:

- **`build`** depends on `lint`, `typecheck`, and `^build` (upstream packages build first)
- **`test`** depends on `^build`
- **`dev`** chains: `shared#dev` → `service#dev` → `ui#dev`

This means `pnpm build` will lint and typecheck before building, and building respects the `shared → service → ui` dependency order.

## Coding Style & Conventions

### Enforced by Biome

- 2-space indentation (spaces, not tabs)
- Single quotes for strings
- Trailing commas
- Semicolons required
- Recommended linter rules enabled (`useLiteralKeys` disabled)

**Biome is the primary formatter/linter.** It runs on pre-commit via Husky + lint-staged, and in CI. ESLint config exists but is secondary.

### TypeScript Conventions

- **Named exports only** — no default exports unless required by framework (TanStack Start pages don't require them)
- **`import type`** — always use top-level `import type` for type-only imports (not inline `import { type ... }`)
- **`interface extends`** over `&` intersections — performance matters
- **Discriminated unions** — use for state modeling (e.g., `ChatResponse = ChatSuccessResponse | ChatErrorResponse`)
- **`readonly` properties** by default on object types
- **`as const` objects** instead of enums
- **`string | undefined`** over optional properties when the field must always be passed
- **Return types** — declare on top-level module functions (except JSX components)
- **Avoid `any`** — only use inside generic function bodies when TypeScript can't match runtime logic to types
- **JSDoc** — concise, only when behavior isn't self-evident; use `@link` for cross-references

### Naming

- **Files:** kebab-case (`answer-question.ts`, `chat-service-binding.ts`) — though existing files may use camelCase
- **Variables/functions:** camelCase
- **Types/interfaces/classes:** PascalCase
- **Constants:** ALL_CAPS
- **Type parameters:** `T`-prefixed (`TKey`, `TValue`, `TInput`)

### Code Organization

- Prefer **pure functions** over classes. Classes only when required (Durable Objects, `WorkerEntrypoint`)
- **`types.ts`** — type definitions and interfaces
- **`utils.ts` or `utils/`** — pure utility functions
- **Feature folders** (e.g., `adapters/`, `schemas/`) for domain logic
- **Barrel exports** via `index.ts` files

### Error Handling

- **Result types** over try/catch for recoverable errors: `{ ok: true, value: T } | { ok: false, error: E }`
- **Throwing** is fine when the framework handles it (e.g., Hono request handlers)
- **Zod `.safeParse()`** for validation with graceful error handling

## Strict TypeScript Configuration

The root `tsconfig.json` enables aggressive strictness — agents must respect these:

| Setting | Impact |
|---------|--------|
| `noUncheckedIndexedAccess` | Array/object indexing returns `T \| undefined`, not `T` |
| `noPropertyAccessFromIndexSignature` | Must use bracket notation for index signatures |
| `noUnusedLocals` / `noUnusedParameters` | Compile error on unused variables |
| `noImplicitReturns` | All code paths must return |
| `noImplicitAny` | No implicit `any` types |
| `noFallthroughCasesInSwitch` | Switch cases must break/return |

**Path aliases:**
- `@/*` → `./apps/*` (root tsconfig)
- `@service/*` → `./apps/service/*` (root tsconfig)
- `~/*` → `./src/*` (UI tsconfig)

## Testing

### Vitest (TypeScript — Service & UI)

**Run:** `pnpm test` (all), `turbo run test --filter @portfolio/service` (scoped)

**Service tests** (`apps/service`):
- Istanbul coverage provider
- Module mocking with `vi.mock()` for adapters, OpenAI client
- `cloudflare:workers` shimmed via `test/cloudflare-workers-shim.ts` (provides minimal `WorkerEntrypoint` class)
- Test `WorkerEntrypoint` class directly by instantiation
- `beforeEach(vi.clearAllMocks)` + `afterEach(vi.restoreAllMocks)` for isolation
- Alias `@documents` → `../../documents` for fixture access

**UI tests** (`apps/ui`):
- jsdom environment with `@vitejs/plugin-react`
- `@testing-library/react` + `@testing-library/jest-dom`
- Global `vitest/globals` — no need to import `describe`, `it`, `expect`
- Setup file (`src/test/setup.ts`): auto-cleanup, localStorage clear, matchMedia mock
- Component tests use `render`, `screen.getByText`, etc.
- Pure function tests for utilities

**Colocated test files:** `*.test.ts` / `*.test.tsx` beside implementation.

### Python (Scripts)

- `unittest.TestCase` with `unittest.mock.patch`
- Fake providers (test doubles) for data access and LLM services
- Run via `python scripts/run_tests.py` or individual: `python -m pytest scripts/test_chunk.py`

## CI/CD

### Pull Requests (`.github/workflows/lint-test.yml`)

Runs on all PRs against `main`:
1. `pnpm lint` — Biome check
2. `pnpm typecheck` — TypeScript
3. `pnpm test` — Vitest
4. `pnpm build` — Full build

Claude AI code review also runs on PRs (`claude-code-review.yml`).

### Deployment

- **Push to `main`** → staging deploy (`deploy-staging.yml`): service, document-processor, r2-reconciliation
- **Push to `prod`** → production deploy (`deploy-production.yml`): same apps
- **Document changes** → R2 sync (`sync-documents.yml`): builds r2-sync, syncs to appropriate environment

### Pre-commit

Husky + lint-staged runs `biome check --write` on staged `.js/.jsx/.ts/.tsx/.json/.jsonc` files.

## Environment & Secrets

### Required Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | service, scripts | OpenAI API key |
| `SUPABASE_URL` | service (legacy) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts | Supabase admin key |
| `SUPABASE_ANON_KEY` | service (legacy) | Supabase anonymous key |
| `CLOUDFLARE_ACCOUNT_ID` | CI/deploy | CF account |
| `CLOUDFLARE_API_TOKEN` | CI/deploy | CF API token |

No `.env.example` files exist — check `turbo.json` `globalEnv` and `wrangler.jsonc` for the authoritative list.

### Cloudflare Bindings (in `wrangler.jsonc`)

| Binding | Type | Description |
|---------|------|-------------|
| `DB` | D1 Database | Chunks, documents, tags |
| `VECTORIZE` | Vectorize Index | Semantic vector search |
| `DOCUMENTS` | R2 Bucket | Full document content |
| `CHAT_SERVICE` | Service Binding | UI → Service RPC (on UI worker) |
| `ENVIRONMENT` | Variable | `"development"` / `"staging"` / `"production"` |

Use `wrangler secret put <KEY>` for Cloudflare-bound secrets. Never commit `.env` files.

### Regenerating Types

After modifying `wrangler.jsonc` bindings, run `pnpm cf-typegen` to regenerate `worker-configuration.d.ts`. This keeps `CloudflareBindings` in sync.

## Gotchas & Non-Obvious Patterns

### Service Binding RPC

The UI doesn't call the service API via HTTP fetch. Instead, it uses **Cloudflare Service Bindings** — the UI worker has a `CHAT_SERVICE` binding that makes in-datacenter calls to the service worker. See `apps/ui/src/lib/qna.ts` and `apps/ui/src/lib/health.ts` for the pattern: `env.CHAT_SERVICE.fetch("/v1/chat")`.

### `cloudflare:workers` Shim in Tests

Service tests can't run in the actual Workers runtime. The shim at `apps/service/test/cloudflare-workers-shim.ts` provides a minimal `WorkerEntrypoint` class so tests work in Node.js with Vitest.

### TanStack Router Auto-Generation

`apps/ui/src/routeTree.gen.ts` is auto-generated from the `src/routes/` directory. Never edit it manually. Adding a new route file triggers regeneration on dev server restart.

### Biome Excludes

Biome skips: `research/`, `.cursor/`, `.claude/`, `.gemini/`, `*.css`, `*.config.js`, `*.config.ts`, `*.d.ts`, `routeTree.gen.ts`. If your changes are in excluded paths, Biome won't lint them.

### Build Order Matters

`turbo build` enforces: `lint` + `typecheck` → `^build` (upstream packages) → `build`. If types in `@portfolio/shared` change, the service and UI will rebuild. Always run `pnpm build` from root to catch cascading issues.

### Three Environments

Each CF Worker app has three environments: `development` (local), `staging` (push to main), `production` (push to prod). Wrangler configs define per-environment D1 databases, Vectorize indexes, and R2 buckets.

### Supabase is Legacy

The `supabase/` directory and Supabase-related code represent the original vector database. The project is transitioning to **D1 + Vectorize** for all data storage. New features should use D1/Vectorize, not Supabase.

### Storybook Plugin Filtering

Storybook's `viteFinal` must strip Cloudflare and TanStack Start Vite plugins — they require a Workers runtime that doesn't exist in Storybook's dev server. See `apps/ui/.storybook/main.ts`.

## Commit & Pull Request Guidelines

- **Format:** `feature(scope): concise summary` — use `chore`, `fix`, `docs`, `feat` as appropriate
- **Subject line:** ≤72 characters
- Stage only related changes
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` before submitting
- PRs should describe intent, list manual verification steps, attach screenshots for UI work
- Reference Supabase migrations or D1 schema changes when touched
