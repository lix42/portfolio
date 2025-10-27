# Repository Guidelines
## Project Structure & Module Organization
- `apps/service`: Cloudflare Worker API built with Hono; business logic lives under `src` and shared bindings in `worker-configuration.d.ts`.
- `apps/ui`: Waku + React client; UI flows live in `src/app`, assets in `public`, and Tailwind config sits in `postcss.config.js`.
- `packages/common-ui`: Shared presentation components and hooks; keep exports tree-shakeable and versioned via the workspace.
- `packages/eslint-config`: Shared ESLint presets (`index.js`, `react.js`, `vitest.js`) consumed by every app.
- Supporting directories: `documents` (RAG source JSON), `scripts` (Python ingestion), `supabase` (SQL schema), and `research` for experiments.

## Build, Test & Development Commands
- `pnpm install` to bootstrap (Node 22.x required).
- `pnpm dev` launches service (Wrangler on :5173) and UI (Waku dev server) together; use `pnpm dev:service` or `pnpm dev:ui` for focused work.
- `pnpm build` runs Biome checks and TypeScript builds for both apps; rely on per-package commands when debugging.
- `pnpm test`, `pnpm test:service`, `pnpm test:ui` execute Vitest suites; add `--runInBand` if worker resources are limited.
- `pnpm lint:check`, `pnpm format:check`, and `pnpm biome:check` gate PRs; use the `:fix` variants before committing.

## Coding Style & Naming Conventions
- Biome enforces 2-space indentation, single quotes, trailing commas, and semicolons; never bypass the formatter.
- TypeScript is the default; prefer type-only imports and optional chaining per shared ESLint rules.
- Components, hooks, and workers use `PascalCase`, helpers use `camelCase`, and files mirror their default export.
- Keep environment-specific bindings in `worker-configuration.d.ts` and `service-bindings.d.ts` so Wrangler typegen stays accurate.

## Testing Guidelines
- Vitest plus `@cloudflare/vitest-pool-workers` powers worker tests; colocate specs as `*.test.ts` beside implementation.
- Mock Supabase and OpenAI clients via `vi.mock` to avoid network calls; assert status codes and payload shapes.
- Update fixtures in `documents/` when ingestion formats change and rerun `pnpm test` before requesting review.

## Commit & Pull Request Guidelines
- Follow observed pattern `feature(scope): concise summary`; use `chore`, `fix`, or `docs` when appropriate and keep subjects ≤72 chars.
- Stage only related changes; include relevant `pnpm` commands in the body when they influence behavior.
- PRs should describe intent, list manual verification, attach screenshots for UI work, and reference Supabase migrations when touched.
- Confirm Biome, lint, tests, and, if applicable, `scripts/ingest_*.py` runs before assigning reviewers.

## Environment & Secrets
- Copy `.env.example` files where present and supply `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Use `wrangler secret put` for Cloudflare bound keys; never commit secrets or generated `.env` files.
