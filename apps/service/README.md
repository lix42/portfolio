# Portfolio Service

## Installation and Development

```txt
pnpm install
pnpm dev
```

```txt
pnpm deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
pnpm cf-typegen
```

Note: `cf-typegen` is intended for local development and requires the local env setup (e.g., `.dev.vars`).

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
