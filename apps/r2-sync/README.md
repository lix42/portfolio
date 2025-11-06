# R2 Sync Client

CLI tool to synchronize local documents to Cloudflare R2 buckets.

## Features

- Content-based sync using SHA-256 hashing
- Syncs both markdown (`.md`) and metadata (`.json`) files
- Automatic retry with exponential backoff
- Interactive mode with detailed logging
- CI/CD mode with JSON-lines output
- Per-file operation tracking with partial failure support

## Usage

### Local Development

```bash
# Preview changes
pnpm sync:r2 --dry-run --env dev

# Sync to dev environment
pnpm sync:r2 --env dev

# Sync with deletions enabled
pnpm sync:r2 --env dev --delete

# Fail fast (stop on first error)
pnpm sync:r2 --env dev --fail-fast
```

### CI/CD Mode

```bash
# Non-interactive mode with JSON output
pnpm sync:r2 --ci --env production

# Each file operation outputs one JSON line
# Final summary as last line
```

## Environment Variables

Required:
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 API token access key ID
- `R2_SECRET_ACCESS_KEY` - R2 API token secret

## Output Formats

### Interactive Mode
```
[10:23:45] Uploading experiments/webforms.md (10.0 KB)...
[10:23:46] ✓ uploaded in 234ms
[10:23:46] Uploading experiments/webforms.json (84 B)...
[10:23:46] ✓ uploaded in 156ms

✓ Sync Complete
  Uploaded:  2
  Deleted:   0
  Unchanged: 5
  Failed:    0
  Duration:  1.25s
```

### CI Mode (JSON Lines)
```jsonl
{"path":"experiments/webforms.md","operation":"upload","status":"success","size":10240,"duration":234}
{"path":"experiments/webforms.json","operation":"upload","status":"success","size":84,"duration":156}
{"summary":{"uploaded":2,"deleted":0,"unchanged":5,"failed":0},"duration":1245,"success":true}
```

## Configuration

See `docs/cloudflare-migration/execution-plans/secrets-management.md` for R2 API token setup.
