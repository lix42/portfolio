# Repository Guidelines

## Project Structure & Module Organization
- `apps/service/`: Cloudflare Worker (Hono) API; runtime config in `wrangler.jsonc`, entry `src/index.ts`.
- `apps/ui/`: React + Waku front-end; route components under `src/pages`, shared primitives in `packages/common-ui/`.
- `packages/common-ui/`: design system exposed as Vite bundle for UI and future surfaces.
- `packages/eslint-config/`: shared ESLint and TypeScript rules consumed across apps.
- `scripts/` & `documents/`: Python ingestion pipeline that feeds Supabase; `supabase/` stores SQL migrations for the vector store.

## Build, Test, and Development Commands
- `pnpm dev` — runs service and UI concurrently (workers on :5173, Waku dev with hot reload).
- `pnpm dev:service` / `pnpm dev:ui` — focus on a single surface while the other is mocked.
- `pnpm build` — lints and type-checks each app before bundling.
- `pnpm test` — executes the Vitest suite for the service worker.
- `pnpm lint` / `pnpm lint:fix` — shared ESLint config via `@portfolio/eslint-config`.
- `pnpm biome:check` / `pnpm biome:fix` — enforce repo-wide formatting (2-space indent, 80-char width, single quotes).

## Coding Style & Naming Conventions
- TypeScript everywhere; keep strict typing, prefer `async/await`, use `camelCase` for functions, `PascalCase` for components/classes.
- Co-locate modules under `src/feature/moduleName.ts`; tests sit beside implementations.
- Rely on Biome and Prettier—do not hand-format. JSX uses double quotes and trailing commas (per `biome.json`).
- Import order is linted; keep side-effect imports first and avoid climbing beyond `../`.

## Testing Guidelines
- Use Vitest with the Cloudflare Workers pool (`apps/service/src/*.test.ts`); mock bindings via the generated `env` helpers.
- New endpoints need request/response and edge-case coverage (timeouts, missing bindings).
- Snapshot tests are discouraged; assert against structured payloads.
- UI tests are emerging—document manual QA in PRs until component checks land.

## Commit & Pull Request Guidelines
- Follow `type(scope): summary` commits (e.g. `feature(service): add streaming context`); keep the summary imperative and <75 chars.
- PRs should explain motivation, approach, and deployment impact, link issues, and attach UI screenshots or curl examples when relevant.
- Ensure `pnpm lint`, `pnpm biome:check`, and `pnpm test` pass locally before requesting review.

## Security & Configuration Tips
- Secrets stay in Cloudflare and Supabase dashboards; never commit `.env`. Local typing mirrors `worker-configuration.d.ts`.
- Regenerate bindings after env changes with `pnpm --filter @portfolio/ui cf-typegen` or `pnpm --filter @portfolio/service cf-typegen`.
- Keep ingestion data private; staged JSON lives in `documents/` and is processed by scripts inside `scripts/`.
