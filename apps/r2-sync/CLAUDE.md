# R2 Sync

CLI tool to synchronize local documents to Cloudflare R2 buckets. Uses content-based SHA-256 hashing to skip unchanged files.

## Architecture

```
documents/        → local-files.ts → syncer.ts → r2-client.ts → Cloudflare R2
(local .md/.json)   (scan + hash)    (diff)       (S3-compat API)
```

Built with `tsup` — compiled to `dist/cli.js` before running.

## Commands

```bash
# Build (required before sync)
pnpm build

# --env is required (staging or production). No default.
# Buckets: staging → portfolio-documents-staging, production → portfolio-documents-prod
# Local dev uses wrangler's local R2 storage (no sync needed).

# Run from repo root (builds then syncs)
pnpm sync:r2 -- --env staging
pnpm sync:r2 -- --env production

# Sync options (append to any command above)
pnpm sync:r2 -- --env staging --dry-run       # Preview changes only
pnpm sync:r2 -- --env staging --delete        # Also delete files removed locally
pnpm sync:r2 -- --env staging --fail-fast     # Stop on first error
pnpm sync:r2 -- --env staging --ci            # Non-interactive JSON-lines output

# Tests
pnpm test
pnpm test:watch

# Type checking
pnpm typecheck
```

## Environment Variables

Required (set in shell or CI secrets):

- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 API token access key ID
- `R2_SECRET_ACCESS_KEY` — R2 API token secret

## Source Files

| File | Purpose |
|------|---------|
| `cli.ts` | Entry point, argument parsing |
| `syncer.ts` | Diff logic: compare local vs remote, decide upload/delete |
| `local-files.ts` | Scan local `documents/` directory |
| `hash.ts` | SHA-256 content hashing |
| `r2-client.ts` | S3-compatible R2 API calls |
| `types.ts` | Shared types |
| `validation.ts` | Input validation |

## Gotchas

- **Build before sync**: `pnpm sync:r2` (root script) runs `turbo run sync` which depends on `build`. Direct `node ./dist/cli.js` requires a manual `pnpm build` first.
- **Syncs both `.md` and `.json`**: Document content (`.md`) and metadata (`.json`) are paired — always keep them in sync.
- See `docs/cloudflare-migration/execution-plans/secrets-management.md` for R2 API token setup.
