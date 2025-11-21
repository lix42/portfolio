#!/bin/bash
# Clean up local R2 storage
set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

R2_STATE_DIR=".wrangler/state/v3/r2"

echo "Cleaning up local R2 storage"
echo "============================="
echo ""

# Check if R2 state directory exists
if [ ! -d "$R2_STATE_DIR" ]; then
  echo -e "${YELLOW}No local R2 storage found at $R2_STATE_DIR${NC}"
  exit 0
fi

# Show current R2 objects before cleanup
echo "Current R2 objects:"
if [ -f "$R2_STATE_DIR/miniflare-R2BucketObject/"*.sqlite ]; then
  sqlite3 "$R2_STATE_DIR/miniflare-R2BucketObject/"*.sqlite \
    "SELECT '  - ' || key FROM _mf_objects ORDER BY key;" 2>/dev/null || echo "  (none)"
else
  echo "  (none)"
fi
echo ""

# Ask for confirmation
read -p "Are you sure you want to delete all local R2 storage? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cleanup cancelled"
  exit 0
fi

echo ""
echo "Deleting local R2 storage..."

# Remove the R2 state directory
rm -rf "$R2_STATE_DIR"

echo -e "${GREEN}✓ Local R2 storage cleaned${NC}"
echo ""
echo "Note: Local R2 storage will be recreated when you run 'pnpm dev' again"
echo "Remember to run './sync-experiments.sh' to repopulate test documents"
