#!/bin/bash
# Phase 2 Verification Script

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 2: R2 Sync Client Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

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

# 1. Check package structure
echo "1️⃣  Package Structure"
check "r2-sync package exists" "test -d apps/r2-sync"
check "package.json exists" "test -f apps/r2-sync/package.json"
check "TypeScript config exists" "test -f apps/r2-sync/tsconfig.json"
check "Source files exist" "test -d apps/r2-sync/src"
check "README exists" "test -f apps/r2-sync/README.md"
echo ""

# 2. Check dependencies
echo "2️⃣  Dependencies"
check "commander installed" "test -d apps/r2-sync/node_modules/commander"
check "chalk installed" "test -d apps/r2-sync/node_modules/chalk"
check "@aws-sdk/client-s3 installed" "test -d apps/r2-sync/node_modules/@aws-sdk/client-s3"
echo ""

# 3. Check build
echo "3️⃣  Build"
echo -n "Checking Can build package... "
if (cd apps/r2-sync && pnpm build) &> /dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  ERRORS=$((ERRORS + 1))
fi
check "CLI executable exists" "test -f apps/r2-sync/dist/cli.js"
check "All source files compiled" "test -f apps/r2-sync/dist/syncer.js && test -f apps/r2-sync/dist/r2-client.js"
echo ""

# 4. Check CLI
echo "4️⃣  CLI Interface"
echo -n "Checking CLI runs --help... "
if (cd apps/r2-sync && node dist/cli.js --help) &> /dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo -n "Checking Root sync:r2 script works... "
if pnpm sync:r2 --help > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Check GitHub Actions
echo "5️⃣  CI/CD"
check "Sync workflow exists" "test -f .github/workflows/sync-documents.yml"
echo ""

# 6. Check documentation
echo "6️⃣  Documentation"
check "Secrets management updated" "grep -q 'R2 API' docs/cloudflare-migration/execution-plans/secrets-management.md"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 2 Verification Complete - All checks passed!${NC}"
  echo ""
  echo "🎉 R2 Sync Client ready!"
  echo ""
  echo "Next Steps:"
  echo "  1. Generate R2 API token (see secrets-management.md)"
  echo "  2. Run: pnpm sync:r2 --dry-run --env dev"
  echo "  3. Run: pnpm sync:r2 --env dev"
  echo ""
  echo "Ready to proceed to Phase 3: Shared Package"
else
  echo -e "${RED}❌ Phase 2 Verification Failed - $ERRORS error(s) found${NC}"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
