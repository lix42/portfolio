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

### CLOUDFLARE_API_TOKEN
Cloudflare API token with the following permissions:
- **Account Settings**: Read
- **Workers Scripts**: Edit
- **D1**: Edit
- **Workers R2 Storage**: Edit
- **Vectorize**: Edit

**To create:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token" → "Create Custom Token"
3. Add the permissions listed above for your account
4. Set Account Resources to your specific account
5. Leave IP filtering as "All IP addresses" (GitHub Actions uses dynamic IPs)
6. Create and copy the token (you won't see it again!)

### CLOUDFLARE_ACCOUNT_ID
Your Cloudflare account ID (find at Dashboard → Account Home)

### OPENAI_API_KEY
OpenAI API key for embeddings generation

## Storing Sensitive Data Locally

For personal reference (NOT in repository), store sensitive data at:
For personal reference (NOT in repository), store sensitive data in a secure local location, for example, a password manager or an encrypted notes file.

This includes:
- API tokens
- Account IDs
- Any credentials you need to reference
