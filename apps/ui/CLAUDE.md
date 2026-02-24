# Portfolio UI

TanStack Start (React) frontend deployed on Cloudflare Workers. Communicates with `@portfolio/service` via a Cloudflare service binding (no HTTP hop).

## Architecture

- **Framework**: TanStack Start (TanStack Router file-based routing)
- **Runtime**: Cloudflare Workers (via Nitro + Wrangler)
- **Styling**: Tailwind CSS v4 + `tw-animate-css`
- **UI components**: shadcn/ui (Base UI primitives), `class-variance-authority`, `clsx`, `tailwind-merge`
- **Data fetching**: TanStack Query
- **Icons**: HugeIcons
- **Service binding**: `CHAT_SERVICE` → `@portfolio/service` Worker

## Commands

```bash
# Dev server (from repo root)
pnpm dev

# Dev server (this package only)
pnpm --filter @portfolio/ui dev

# Build
pnpm build

# Preview production build
pnpm preview

# Deploy to Cloudflare
pnpm deploy

# Storybook component explorer
pnpm storybook

# Build Storybook static site
pnpm build-storybook

# Type checking
pnpm typecheck

# Tests
pnpm test

# Generate Cloudflare bindings types
pnpm cf-typegen
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/router.tsx` | TanStack Router entry point |
| `src/routes/__root.tsx` | Root layout |
| `src/routes/index.tsx` | Home page |
| `src/routes/health/` | Health check page |
| `src/components/ui/` | Shared UI primitives (Button, Card, Badge, etc.) |
| `src/components/HealthStatus.tsx` | Fetches health via service binding |
| `src/components/ModeToggler.tsx` | Dark/light mode toggle |
| `wrangler.jsonc` | Cloudflare bindings configuration |
| `vite.config.ts` | Vite + TanStack Start plugin config |

## Component Library

UI components in `src/components/ui/` are shadcn/ui components (built on Base UI primitives) with CVA variants. Each component has a `.stories.tsx` file for Storybook. Run `pnpm storybook` to explore them interactively.

## Gotchas

- **Route file naming**: TanStack Router uses file-based routing — `routeTree.gen.ts` is auto-generated. Do not edit it manually; it regenerates on `dev`/`build`.
- **Service binding vs HTTP**: The UI calls `@portfolio/service` via the `CHAT_SERVICE` binding, not HTTP. Local dev requires both workers running or the service binding to be configured in `wrangler.jsonc`.
