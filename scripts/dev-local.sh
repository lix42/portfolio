#!/bin/bash
# Local development environment startup script
# Starts D1, Vectorize, and R2 locally with Wrangler

set -e

echo "🚀 Starting Portfolio RAG local development environment..."
echo ""

# Check Wrangler is available
if ! command -v wrangler &> /dev/null && ! pnpm wrangler --version &> /dev/null; then
  echo "❌ Wrangler not found. Install with: pnpm add -g wrangler"
  exit 1
fi

echo "✅ Wrangler available"
echo ""

# Start service in dev mode
echo "Starting service on http://localhost:5173"
echo "Local D1, R2, and Vectorize will be available"
echo ""

cd apps/service
pnpm dev --local --persist-to .wrangler/state
