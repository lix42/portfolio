#!/bin/bash
# Phase 4 Verification Script
# Validates the document processor implementation

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 4: Document Processor Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

check() {
  local name=$1
  local command=$2

  echo -n "  Checking $name... "
  if eval "$command" &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

info() {
  echo -e "${YELLOW}  ℹ $1${NC}"
}

# 1. Check document-processor package structure
echo "1️⃣  Document Processor Package Structure"
check "package exists" "test -d apps/document-processor"
check "package.json exists" "test -f apps/document-processor/package.json"
check "wrangler.jsonc exists" "test -f apps/document-processor/wrangler.jsonc"
check "tsconfig.json exists" "test -f apps/document-processor/tsconfig.json"
check "README.md exists" "test -f apps/document-processor/README.md"
check "LOCAL_DEVELOPMENT.md exists" "test -f apps/document-processor/LOCAL_DEVELOPMENT.md"
echo ""

# 2. Check source files
echo "2️⃣  Source Files"
check "index.ts exists" "test -f apps/document-processor/src/index.ts"
check "document-processor.ts exists" "test -f apps/document-processor/src/document-processor.ts"
check "types.ts exists" "test -f apps/document-processor/src/types.ts"
check "steps/ directory exists" "test -d apps/document-processor/src/steps"
check "utils/ directory exists" "test -d apps/document-processor/src/utils"
echo ""

# 3. Check r2-reconciliation package
echo "3️⃣  R2 Reconciliation Package"
check "package exists" "test -d apps/r2-reconciliation"
check "package.json exists" "test -f apps/r2-reconciliation/package.json"
check "wrangler.jsonc exists" "test -f apps/r2-reconciliation/wrangler.jsonc"
check "index.ts exists" "test -f apps/r2-reconciliation/src/index.ts"
check "reconcile.ts exists" "test -f apps/r2-reconciliation/src/reconcile.ts"
echo ""

# 4. Check TypeScript compilation
echo "4️⃣  TypeScript Compilation"
check "document-processor compiles" "(cd apps/document-processor && pnpm exec tsc --noEmit)"
check "r2-reconciliation compiles" "(cd apps/r2-reconciliation && pnpm exec tsc --noEmit)"
echo ""

# 5. Check tests
echo "5️⃣  Unit Tests"
check "document-processor tests exist" "test -f apps/document-processor/src/document-processor.test.ts"
check "r2-reconciliation tests exist" "test -f apps/r2-reconciliation/src/reconcile.test.ts"
check "document-processor tests pass" "(cd apps/document-processor && pnpm test)"
check "r2-reconciliation tests pass" "(cd apps/r2-reconciliation && pnpm test)"
echo ""

# 6. Check GitHub workflows
echo "6️⃣  GitHub Workflows"
check "deploy-staging.yml has document-processor" "grep -q 'deploy-document-processor-staging' .github/workflows/deploy-staging.yml"
check "deploy-production.yml has document-processor" "grep -q 'deploy-document-processor-production' .github/workflows/deploy-production.yml"
check "deploy-staging.yml has r2-reconciliation" "grep -q 'deploy-r2-reconciliation-staging' .github/workflows/deploy-staging.yml"
check "deploy-production.yml has r2-reconciliation" "grep -q 'deploy-r2-reconciliation-production' .github/workflows/deploy-production.yml"
echo ""

# 7. Check wrangler configs have correct bindings
echo "7️⃣  Wrangler Configuration"
check "document-processor has D1 binding" "grep -q 'portfolio-sql-staging' apps/document-processor/wrangler.jsonc"
check "document-processor has R2 binding" "grep -q 'portfolio-documents-staging' apps/document-processor/wrangler.jsonc"
check "document-processor has Vectorize binding" "grep -q 'portfolio-embeddings-staging' apps/document-processor/wrangler.jsonc"
check "document-processor has Queue binding" "grep -q 'portfolio-doc-processing-staging' apps/document-processor/wrangler.jsonc"
check "r2-reconciliation has correct R2 (staging)" "grep -q 'portfolio-documents-staging' apps/r2-reconciliation/wrangler.jsonc"
check "r2-reconciliation has correct R2 (prod)" "grep -q 'portfolio-documents-prod' apps/r2-reconciliation/wrangler.jsonc"
echo ""

# 8. Check deployment readiness (dry-run)
echo "8️⃣  Deployment Readiness"
check "document-processor wrangler config valid" "(cd apps/document-processor && wrangler deploy --dry-run --outdir /tmp/wrangler-dp-test 2>/dev/null)"
check "r2-reconciliation wrangler config valid" "(cd apps/r2-reconciliation && wrangler deploy --dry-run --outdir /tmp/wrangler-r2r-test 2>/dev/null)"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 4 Verification Complete - All checks passed!${NC}"
  echo ""
  echo "Phase 4 Implementation Summary:"
  echo "  • Document Processor with Durable Objects state machine"
  echo "  • R2 Reconciliation Worker for self-healing"
  echo "  • Queue-based event processing from R2"
  echo "  • GitHub Actions deployment workflows"
  echo ""
  echo "Deployed Endpoints:"
  echo "  • Staging: https://portfolio-document-processor-staging.i-70e.workers.dev"
  echo "  • R2 Reconciliation: https://portfolio-r2-reconciliation-staging.i-70e.workers.dev"
  echo ""
  echo "Next Steps:"
  echo "  1. Test end-to-end processing with a real document"
  echo "  2. Monitor queue processing via wrangler tail"
  echo "  3. Ready for Phase 5: Query Service updates"
else
  echo -e "${RED}❌ Phase 4 Verification Failed - $ERRORS error(s) found${NC}"
  echo ""
  echo "Please fix the errors above before proceeding."
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
