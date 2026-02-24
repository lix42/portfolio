---
name: cf-bindings
description: Manage Cloudflare Workers bindings (D1, R2, Vectorize, Queues, KV, service bindings). Use this skill when adding, modifying, or looking up bindings in any app — e.g. "add a KV binding", "what bindings does service have?", "set up a new D1 database".
disable-model-invocation: true
---

## Adding or modifying a binding

1. Edit `wrangler.jsonc` in the target app to add the binding
2. Run `pnpm cf-typegen` (in the app directory) to regenerate `worker-configuration.d.ts`
3. Access the binding via `c.env.<BINDING_NAME>` (Hono) or the appropriate framework API

## Current bindings by app

### apps/ui

Configured in `apps/ui/wrangler.jsonc`:
- `VALUE_FROM_CLOUDFLARE` — KV text value
- `CHAT_SERVICE` — Service binding to `@portfolio/service` Worker

### apps/service

Configured in `apps/service/wrangler.jsonc`:
- `DB` — D1 database
- `VECTORIZE` — Vectorize index
- `DOCUMENTS` — R2 bucket

Service binding export: `ChatServiceBinding` (WorkerEntrypoint) exposes `health()` and `chat(message)` for Worker-to-Worker calls from `apps/ui`.

### apps/document-processor

Configured in `apps/document-processor/wrangler.jsonc`:

| Environment | D1 | R2 Bucket | Vectorize | Queue |
|-------------|-----|-----------|-----------|-------|
| Local | `portfolio-sql-staging` (remote) | local storage | `portfolio-embeddings-staging` | `portfolio-doc-processing-local` |
| Staging | `portfolio-sql-staging` | `portfolio-documents-staging` | `portfolio-embeddings-staging` | `portfolio-doc-processing-staging` |
| Production | `portfolio-sql-prod` | `portfolio-documents-prod` | `portfolio-embeddings-prod` | `portfolio-doc-processing-prod` |
