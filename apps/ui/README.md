# @portfolio/ui

A TanStack Start prototype that exercises the `@portfolio/service` health endpoint via a Cloudflare service binding.

## Scripts

- `pnpm --filter @portfolio/ui dev` – start the Vite dev server.
- `pnpm --filter @portfolio/ui build` – produce a production build and run TypeScript checks.
- `pnpm --filter @portfolio/ui deploy` – deploy with Wrangler (env comes from Wrangler config).

## Environment

The worker expects the following bindings:

- `VALUE_FROM_CLOUDFLARE` – a simple message displayed on the home screen.
- `CHAT_SERVICE` – service binding pointing at the `@portfolio/service` worker so that `/v1/health` can be queried.
