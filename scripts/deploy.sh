#!/bin/bash
# Deployment script for Cloudflare Workers
# Usage: ./scripts/deploy.sh <app-name> <environment>

set -e

APP=$1
ENV=${2:-production}

if [ -z "$APP" ]; then
  echo "Usage: ./scripts/deploy.sh <app-name> <environment>"
  echo ""
  echo "Apps: service, document-processor"
  echo "Environments: staging, production"
  echo ""
  echo "Example: ./scripts/deploy.sh service staging"
  exit 1
fi

echo "🚀 Deploying $APP to $ENV environment..."

cd "apps/$APP"

if [ "$ENV" = "staging" ]; then
  wrangler deploy --env staging
elif [ "$ENV" = "production" ]; then
  wrangler deploy --env production
else
  echo "❌ Unknown environment: $ENV"
  exit 1
fi

echo "✅ Deployment complete!"
