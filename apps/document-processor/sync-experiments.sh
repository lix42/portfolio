#!/bin/bash
# Sync files from /documents/experiments/ to local R2 storage
set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

EXPERIMENTS_DIR="../../documents/experiments"
BUCKET_NAME="portfolio-documents-local"

echo "Syncing experiments to local R2 storage"
echo "========================================"
echo ""

# Check if experiments directory exists
if [ ! -d "$EXPERIMENTS_DIR" ]; then
  echo "Error: $EXPERIMENTS_DIR does not exist"
  exit 1
fi

# Find all files in experiments directory
FILES=$(find "$EXPERIMENTS_DIR" -type f)

if [ -z "$FILES" ]; then
  echo "No files found in $EXPERIMENTS_DIR"
  exit 0
fi

# Upload each file to local R2
COUNT=0
for FILE in $FILES; do
  # Get filename relative to experiments directory
  FILENAME=$(basename "$FILE")
  R2_KEY="experiments/$FILENAME"

  echo -n "Uploading $FILENAME to $R2_KEY... "

  if wrangler r2 object put "$BUCKET_NAME/$R2_KEY" \
    --file="$FILE" \
    --local > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    COUNT=$((COUNT + 1))
  else
    echo -e "${YELLOW}✗ Failed${NC}"
  fi
done

echo ""
echo -e "${GREEN}✓ Synced $COUNT file(s) to local R2 storage${NC}"
echo ""
echo "Files are available at:"
echo "  R2 keys: experiments/<filename>"
echo "  Local storage: .wrangler/state/v3/r2/$BUCKET_NAME/"
