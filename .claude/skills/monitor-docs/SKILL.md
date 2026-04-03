---
name: monitor-docs
description: Monitor document processing pipeline after a documents update PR is merged. Takes a PR number or URL, determines staging/prod from the base branch, then checks GitHub Actions, R2 sync, document-processor status, and D1 data. Use when the user says "monitor docs", "check document processing", "watch the doc pipeline", or wants to verify documents were ingested after a PR merge.
---

# Monitor Document Processing Pipeline

Monitor the end-to-end document ingestion pipeline after a PR containing `documents/` changes is merged.

## Input

Takes a PR number or GitHub PR URL as argument. Example:
- `/monitor-docs 42`
- `/monitor-docs https://github.com/lix42/portfolio/pull/42`

## Environment Detection

Determine staging vs production from the PR's base branch:

```bash
gh pr view <PR> --json baseRefName -q '.baseRefName'
```

| Base branch | Environment | Worker URL | D1 Database ID |
|---|---|---|---|
| `main` | staging | `https://portfolio-document-processor-staging.i-70e.workers.dev` | `b287f8a6-1760-4092-8f2f-3f3f453cfe4f` |
| `prod` | production | `https://portfolio-document-processor-prod.i-70e.workers.dev` | `e8ae40da-e089-47f8-8845-7586f7a555ec` |

## Steps

Run these steps sequentially. Report status after each step before proceeding to the next.

### Step 1: PR Status

Check that the PR is merged:

```bash
gh pr view <PR> --json state,mergedAt,baseRefName,headRefName
```

If not merged, report the current state and stop. The pipeline only runs after merge.

### Step 2: Identify Changed Documents

Extract document file paths changed in the PR:

```bash
gh pr diff <PR> --name-only | grep '^documents/'
```

Convert file paths to R2 keys by stripping the `documents/` prefix:
- `documents/experiments/webforms.md` -> R2 key: `experiments/webforms.md`
- `documents/prompts.json` -> R2 key: `prompts.json`

If no `documents/` files were changed, report that and stop — the sync workflow won't trigger.

### Step 3: GitHub Actions — Sync Documents Workflow

Check if the "Sync Documents to R2" workflow ran successfully after merge:

```bash
gh run list --workflow=sync-documents.yml --branch=<base-branch> --limit=5
```

Find the run that corresponds to the merge commit. If it failed or is still running:

```bash
gh run view <run-id>
gh run view <run-id> --log-failed   # if failed
```

Report the workflow status. If failed, show the failure logs and stop.

### Step 4: GitHub Actions — Deploy Workflow

Check the deploy workflow also succeeded (it runs in parallel):

```bash
# staging
gh run list --workflow=deploy-staging.yml --limit=3

# production
gh run list --workflow=deploy-production.yml --limit=3
```

Report status. A deploy failure doesn't block document processing (the worker was already deployed), but it's worth noting.

### Step 5: Document Processor Status

For each changed `.md` file, check its processing status via the document-processor API:

```bash
curl -s "https://<worker-url>/status?r2key=<r2-key>"
```

The response contains:
- `status`: `not_started`, `processing`, `completed`, `failed`
- `currentStep`: `download`, `embeddings`, `tags`, `store`, `complete`
- `progress`: chunk counts and percentage
- `errors`: any processing errors
- `timing`: start/complete/fail timestamps

Report the status of each document. If any are `processing`, wait 10-15 seconds and re-check (processing involves multiple async steps via Durable Object alarms). Retry up to 3 times.

If any document is `failed`, show the errors array and suggest using `POST /resume` or `POST /reprocess`.

### Step 6: Verify D1 Data

For each completed document, verify it exists in D1 using the Cloudflare MCP `d1_database_query` tool:

```sql
SELECT d.id, d.r2_key, d.project, d.tags, d.company_id,
       COUNT(c.id) as chunk_count,
       d.created_at
FROM documents d
LEFT JOIN chunks c ON c.document_id = d.id
WHERE d.r2_key = '<r2-key>'
GROUP BY d.id
```

Use the D1 database ID for the detected environment.

Report: document ID, chunk count, tags, and company association.

### Step 7: Verify Chunk Data (Optional Detail)

If the user wants more detail, or if chunk_count is 0 (suspicious), query chunks:

```sql
SELECT id, vectorize_id, LENGTH(content) as content_length, tags
FROM chunks
WHERE document_id = <document-id>
ORDER BY id
```

Verify each chunk has a `vectorize_id` (meaning embeddings were stored in Vectorize).

## Output Summary

After all steps, produce a summary table:

```
## Document Processing Summary (<environment>)

PR: #<number> (<head> -> <base>), merged at <time>
Sync workflow: <status>
Deploy workflow: <status>

| Document | R2 Key | Status | Chunks | Tags | Errors |
|----------|--------|--------|--------|------|--------|
| ... | ... | ... | ... | ... | ... |

### Issues
- (list any problems found)

### Next Steps
- (suggestions if anything failed)
```

## Error Handling

- If a `curl` to the worker URL fails, report that the worker may not be deployed or reachable
- If D1 query fails, report the error and suggest checking the database
- If a document is stuck in `processing` after 3 retries, suggest checking `wrangler tail` for live logs
- Non-`.md` files in `documents/` (e.g., `prompts.json`, `companies.json`) won't go through the document processor — they are synced to R2 only. Report them as "synced to R2 (no processing needed)"
