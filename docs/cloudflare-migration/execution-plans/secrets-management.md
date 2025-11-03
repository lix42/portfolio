# Secrets Management

## Overview

Cloudflare Workers secrets are encrypted environment variables that are NOT stored in wrangler.jsonc.

## Required Secrets

### Document Processor
- `OPENAI_API_KEY`: OpenAI API key for embeddings and tag generation

### Query Service (existing)
- `OPENAI_API_KEY`: OpenAI API key for chat completions
- `SUPABASE_URL`: (Will be removed in Phase 5)
- `SUPABASE_SERVICE_ROLE_KEY`: (Will be removed in Phase 5)

## Setting Secrets

### Via CLI (Production)
```bash
# Document processor - Development
echo "your-api-key" | wrangler secret put OPENAI_API_KEY --name portfolio-document-processor

# Staging
echo "your-api-key" | wrangler secret put OPENAI_API_KEY --name portfolio-document-processor --env staging

# Production
echo "your-api-key" | wrangler secret put OPENAI_API_KEY --name portfolio-document-processor --env production
```

### Via .dev.vars (Local Development)

Create `apps/<app-name>/.dev.vars`:
```env
OPENAI_API_KEY=sk-proj-...
ENVIRONMENT=development
```

**⚠️ NEVER commit .dev.vars to git!**

## Listing Secrets

```bash
# List secrets for a worker
wrangler secret list --name portfolio-document-processor
```

## Deleting Secrets

```bash
# Delete a secret
wrangler secret delete OPENAI_API_KEY --name portfolio-document-processor
```

## CI/CD Secrets

For GitHub Actions, set these repository secrets:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Worker write permissions
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `OPENAI_API_KEY`: OpenAI API key

## Storing Sensitive Data Locally

For personal reference (NOT in repository), store sensitive data at:
`/Users/lix/Documents/Obsidian/Notes/Notes/Portfolio/Secrets.md`

This includes:
- API tokens
- Account IDs
- Any credentials you need to reference
