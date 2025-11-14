# @portfolio/tanstack-ui

A TanStack Start prototype that exercises the `@portfolio/service` health endpoint via a Cloudflare service binding.

## Scripts

- `pnpm dev --filter @portfolio/tanstack-ui` – start the Vite dev server.
- `pnpm build --filter @portfolio/tanstack-ui` – produce a production build and run TypeScript checks.
- `pnpm deploy --filter @portfolio/tanstack-ui` – build and deploy with Wrangler.

## Environment

The worker expects the following bindings:

- `VALUE_FROM_CLOUDFLARE` – a simple message displayed on the home screen.
- `CHAT_SERVICE` – service binding pointing at the `@portfolio/service` worker so that `/v1/health` can be queried.
