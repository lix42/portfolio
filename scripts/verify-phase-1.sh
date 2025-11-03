#!/bin/bash
# Phase 1 Infrastructure Verification Script

set -e

# Change to repo root directory (script is in /scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 1: Infrastructure Setup Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check function
check() {
  local name=$1
  local command=$2

  echo -n "Checking $name... "
  if eval "$command" &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

# 1. Check Wrangler
echo "1️⃣  Wrangler CLI"
check "Wrangler installed" "command -v wrangler"
check "Wrangler authenticated" "wrangler whoami"
echo ""

# 2. Check D1 Databases
echo "2️⃣  D1 Databases"
check "Dev database exists" "wrangler d1 list | grep -q 'portfolio-dev'"
check "Staging database exists" "wrangler d1 list | grep -q 'portfolio-staging'"
check "Production database exists" "wrangler d1 list | grep -q 'portfolio-prod'"

# Check schema
echo -n "Checking dev database schema... "
TABLE_COUNT=$(wrangler d1 execute portfolio-dev \
  --remote \
  --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('companies', 'documents', 'chunks');" 2>&1 | grep '"count":' | grep -Eo '[0-9]+' || echo "0")

if [ "$TABLE_COUNT" = "3" ]; then
  echo -e "${GREEN}✓ (3 tables)${NC}"
else
  echo -e "${RED}✗ (expected 3, found $TABLE_COUNT)${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Check Vectorize
echo "3️⃣  Vectorize Indexes"
check "Dev index exists" "wrangler vectorize list | grep -q 'portfolio-embeddings-dev'"
check "Staging index exists" "wrangler vectorize list | grep -q 'portfolio-embeddings-staging'"
check "Production index exists" "wrangler vectorize list | grep -q 'portfolio-embeddings-prod'"
echo ""

# 4. Check R2 Buckets
echo "4️⃣  R2 Buckets"
check "Dev bucket exists" "wrangler r2 bucket list | grep -q 'portfolio-documents-dev'"
check "Staging bucket exists" "wrangler r2 bucket list | grep -q 'portfolio-documents-staging'"
check "Production bucket exists" "wrangler r2 bucket list | grep -q 'portfolio-documents-prod'"
echo ""

# 5. Check Queues
echo "5️⃣  Queues"
check "Dev queue exists" "wrangler queues list | grep -q 'portfolio-doc-processing-dev'"
check "Dev DLQ exists" "wrangler queues list | grep -q 'portfolio-doc-processing-dev-dlq'"
check "Staging queue exists" "wrangler queues list | grep -q 'portfolio-doc-processing-staging'"
check "Staging DLQ exists" "wrangler queues list | grep -q 'portfolio-doc-processing-staging-dlq'"
check "Production queue exists" "wrangler queues list | grep -q 'portfolio-doc-processing-prod'"
check "Production DLQ exists" "wrangler queues list | grep -q 'portfolio-doc-processing-prod-dlq'"
echo ""

# 6. Check File Structure
echo "6️⃣  File Structure"
check "Database migrations directory" "test -d apps/database/migrations"
check "Initial schema migration" "test -f apps/database/migrations/0001_initial_schema.sql"
check "Test data migration" "test -f apps/database/migrations/0002_test_data.sql"
check "Document processor config" "test -f apps/document-processor/wrangler.jsonc"
check "Service config exists" "test -f apps/service/wrangler.jsonc"
check "Resource IDs documented" "test -f docs/cloudflare-migration/execution-plans/phase-1-resources.json"
check "Helper scripts exist" "test -x scripts/dev-local.sh && test -x scripts/deploy.sh"
echo ""

# 7. Check Configuration
echo "7️⃣  Infrastructure as Code"
echo -n "Checking service config has D1 bindings... "
if grep -q '"d1_databases"' apps/service/wrangler.jsonc 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  ERRORS=$((ERRORS + 1))
fi

echo -n "Checking document-processor config... "
if test -f apps/document-processor/wrangler.jsonc; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 8. Check Secrets
echo "8️⃣  Secrets Configuration"
check ".dev.vars in .gitignore" "grep -q '.dev.vars' .gitignore"
check "Secrets documentation" "test -f docs/cloudflare-migration/execution-plans/secrets-management.md"
check ".dev.vars created" "test -f apps/document-processor/.dev.vars"
echo ""

# 9. Check Scripts
echo "9️⃣  Helper Scripts"
check "Local dev script" "test -x scripts/dev-local.sh"
check "Deploy script" "test -x scripts/deploy.sh"
check "Verification script" "test -x scripts/verify-phase-1.sh"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 1 Verification Complete - All checks passed!${NC}"
  echo ""
  echo "🎉 Ready to proceed to Phase 2: R2 Sync Client"
  echo ""
  echo "Resources Created:"
  echo "  • 3 D1 databases with schema"
  echo "  • 3 Vectorize indexes (1536 dims, cosine)"
  echo "  • 3 R2 buckets"
  echo "  • 6 Queues (3 main + 3 DLQs)"
  echo ""
  echo "Next: See docs/cloudflare-migration/02-implementation-plan.md#phase-2"
else
  echo -e "${RED}❌ Phase 1 Verification Failed - $ERRORS error(s) found${NC}"
  echo ""
  echo "Please fix the errors above before proceeding to Phase 2"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
