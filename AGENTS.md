# Repository Guidelines

## Project Structure & Module Organization
- `apps/service`: Cloudflare Worker written with Hono + Vite; owns `/v1/chat` API and related utilities under `src/**`.
- `apps/ui`: React + Waku chat interface; consumes shared primitives from `packages/common-ui`.
- `packages/common-ui` and `packages/*-config`: shared UI kit plus lint/biome/env configs imported via workspace ranges; update here before copying per-app overrides.
- `scripts/` and `documents/`: Python ingestion pipeline plus JSON manifests that map projects to markdown sources; these feed the RAG knowledge base.
- `supabase/`: SQL schema, functions, and migration helpers needed before enabling embeddings storage.

## Build, Test, and Development Commands
- `pnpm dev` starts service + UI concurrently; use `pnpm run dev:service` or `dev:ui` to focus on a single surface.
- `pnpm run build` runs lint, type-check, and bundling for both apps; Cloudflare releases use `pnpm --filter @portfolio/service deploy` after a passing build.
- `pnpm --filter @portfolio/service test` executes the Vitest suite; append `--runInBand` when debugging worker bindings or flakiness.
- Quality gates: `pnpm run lint:check`, `format:check`, and `biome:check` (fix via matching `:fix` scripts) must be clean before review.
- Data refresh: `pip install -r requirements.txt` then `python scripts/ingest_documents.py` to re-embed any updated markdown.

## Coding Style & Naming Conventions
- TypeScript-first with modules under `src/**`; export via barrel files for reuse across apps.
- Prettier enforces 2-space indentation, single quotes, and trailing commas—never hand-format.
- Shared ESLint config (`packages/eslint-config`) requires optional chaining/nullish coalescing, forbids floating promises, and de-duplicates imports.
- React components/hooks use PascalCase file names; utilities stay camelCase. Shared UI should live in `packages/common-ui/src` to avoid duplication.

## Testing Guidelines
- Store tests next to implementation as `*.test.ts`; align `describe()` labels with route or module names (e.g., `describe('/v1/chat')`).
- Use Vitest mocks for Supabase/OpenAI clients; do not hit live services in unit tests.
- For ingestion scripts, add fixtures under `scripts/__fixtures__` and capture manual verification notes in the PR when real data is required.
- Run `pnpm --filter @portfolio/service test -- --coverage` before review whenever backend logic changes.

## Commit & Pull Request Guidelines
- Follow current history: short, present-tense subjects (e.g., `Add Biome linting configuration`), optional scope tags, and link issues/PR numbers.
- Each commit should include related docs/tests; squash noisy fixups before pushing.
- PRs must describe intent, list verification commands, link Supabase migrations when relevant, and attach UI screenshots/gifs for `apps/ui` changes.
- Ensure `pnpm run lint:check` and service tests pass locally; call out any known flake (e.g., worker preview) in the PR body.

## Security & Configuration Tips
- Keep secrets out of git; rely on `env-config/` templates and `.env.example` per app, plus `supabase/init.sql` for reproducible DB state.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` when sharing previews, and scope OpenAI keys to ingestion vs. runtime workloads.
