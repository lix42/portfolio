#!/bin/bash
# Test document processor locally
#
# This script tests the full local development workflow:
# 1. Syncs test documents to local R2
# 2. Verifies worker is running
# 3. Triggers processing via HTTP fetch API
# 4. Polls for completion status
set -e

echo "Testing Document Processor (Local Workflow)"
echo "============================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Sync documents to local R2
echo -e "${BLUE}1. Syncing test documents to local R2...${NC}"
if [ -f "./sync-experiments.sh" ]; then
  ./sync-experiments.sh
  echo ""
else
  echo -e "${YELLOW}⚠ sync-experiments.sh not found, skipping sync${NC}"
  echo ""
fi

# 2. Verify documents in local R2
echo -e "${BLUE}2. Verifying documents in local R2...${NC}"
if [ -f .wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite ]; then
  DOCS_COUNT=$(sqlite3 .wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite \
    "SELECT COUNT(*) FROM _mf_objects WHERE key LIKE 'experiments/%';" 2>/dev/null || echo "0")

  if [ "$DOCS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $DOCS_COUNT document(s) in local R2${NC}"
  else
    echo -e "${YELLOW}⚠ No documents found in local R2${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Local R2 storage not initialized yet${NC}"
fi
echo ""

# 3. Check health
echo -e "${BLUE}3. Health check...${NC}"
if curl -s http://localhost:8787/health | jq . 2>/dev/null; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
  echo "Make sure the dev server is running: pnpm dev"
  exit 1
fi
echo ""

# 4. Trigger processing
echo -e "${BLUE}4. Triggering processing via HTTP fetch API...${NC}"
TRIGGER_RESULT=$(curl -s -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -d '{"r2Key": "experiments/test.md"}')

if echo $TRIGGER_RESULT | jq . 2>/dev/null; then
  echo -e "${GREEN}✓ Processing triggered (via fetch API, not queue)${NC}"
else
  echo -e "${RED}✗ Failed to trigger processing${NC}"
  echo $TRIGGER_RESULT
  exit 1
fi
echo ""

# 5. Wait for processing
echo -e "${BLUE}5. Waiting 10 seconds for processing...${NC}"
for i in {10..1}; do
  echo -n "$i..."
  sleep 1
done
echo ""
echo ""

# 6. Check status
echo -e "${BLUE}6. Checking processing status...${NC}"
STATUS_RESULT=$(curl -s "http://localhost:8787/status?r2Key=experiments/test.md")

if echo $STATUS_RESULT | jq . 2>/dev/null; then
  echo -e "${GREEN}✓ Status retrieved${NC}"
  echo ""
  echo "Processing Status:"
  echo $STATUS_RESULT | jq .

  # Check if completed
  STATUS=$(echo $STATUS_RESULT | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo -e "${GREEN}✓✓✓ Test PASSED - Document processing completed successfully!${NC}"
  elif [ "$STATUS" = "failed" ]; then
    echo ""
    echo -e "${RED}✗✗✗ Test FAILED - Document processing failed${NC}"
    exit 1
  else
    echo ""
    echo -e "${YELLOW}⚠ Processing still in progress (status: $STATUS)${NC}"
  fi
else
  echo -e "${RED}✗ Failed to get status${NC}"
  echo $STATUS_RESULT
  exit 1
fi
echo ""

echo "============================================"
echo "Test complete!"
echo "============================================"
echo ""
echo -e "${BLUE}Local Testing Architecture:${NC}"
echo "  - R2: Local storage (.wrangler/state/v3/r2/)"
echo "  - D1: Remote staging (portfolio-sql-staging)"
echo "  - Vectorize: Remote staging (portfolio-embeddings-staging)"
echo "  - API: HTTP fetch (queue consumer not used)"
echo ""
echo -e "${BLUE}Additional Commands:${NC}"
echo ""
echo "  # Reprocess a document (cleans up and restarts)"
echo "  curl -X POST http://localhost:8787/reprocess \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"r2Key\": \"experiments/test.md\"}'"
echo ""
echo "  # Check all documents in local R2"
echo "  sqlite3 .wrangler/state/v3/r2/miniflare-R2BucketObject/*.sqlite \\"
echo "    \"SELECT key FROM _mf_objects ORDER BY key;\""
echo ""
echo "  # Clean up local R2"
echo "  ./clean-local-r2.sh"
echo ""
echo "  # Query remote staging D1"
echo "  wrangler d1 execute portfolio-sql-staging \\"
echo "    --command \"SELECT * FROM documents;\""
echo ""
echo "============================================"
