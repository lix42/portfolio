# Phase 1: Infrastructure Setup - Detailed Execution Plan

**Duration**: 1 week
**Status**: Ready to Execute
**Prerequisites**: Cloudflare account with Workers Paid plan (required for D1, Vectorize)

---

## Overview

This execution plan provides step-by-step instructions for Phase 1: Infrastructure Setup using an **Infrastructure as Code (IaC)** approach where possible.

**Cloudflare's IaC Model**:
1. **CLI Creation**: Resources (D1, R2, Vectorize, Queues) are created via `wrangler` CLI commands
2. **Configuration as Code**: Resource bindings are defined in `wrangler.jsonc` files (version controlled)
3. **Environment Management**: Different environments use separate resource IDs in the same config file

---

## Final Directory Structure

After completing the full migration (all phases), the codebase will look like:

```
port-db/
├── apps/
│   ├── service/              # Query service (existing, updated in Phase 5)
│   │   ├── src/
│   │   ├── wrangler.jsonc    # Updated with D1, Vectorize, R2 bindings
│   │   └── package.json
│   ├── ui2/                  # React Router 7 UI (existing)
│   ├── document-processor/   # NEW in Phase 4 - Durable Objects worker
│   │   ├── src/
│   │   │   ├── index.ts      # Worker entry point
│   │   │   └── durable-objects/
│   │   │       └── document-processor.ts  # DO state machine
│   │   ├── wrangler.jsonc    # D1, R2, Vectorize, Queue, DO bindings
│   │   └── package.json
│   ├── r2-sync/              # NEW in Phase 2 - CLI tool
│   │   ├── src/
│   │   │   └── index.ts      # Sync logic
│   │   ├── package.json
│   │   └── README.md
│   └── database/             # NEW in Phase 1 - D1 migrations
│       ├── migrations/
│       │   ├── 0001_initial_schema.sql
│       │   └── 0002_test_data.sql
│       └── schema.md         # Schema documentation
├── packages/
│   └── shared/               # NEW in Phase 3 - Shared utilities
│       ├── src/
│       │   ├── prompts.ts    # Migrated from documents/prompts.json
│       │   ├── chunking.ts
│       │   ├── embeddings.ts
│       │   └── tags.ts
│       ├── package.json
│       └── tsconfig.json
├── documents/                # Existing - source markdown files
│   └── experiments/
├── scripts/
│   ├── dev-local.sh          # Start local development
│   ├── deploy.sh             # Deploy to environments
│   └── verify-phase-1.sh     # Phase 1 verification
└── docs/
    └── cloudflare-migration/
        ├── execution-plans/
        │   ├── phase-1-resources.json  # Resource IDs (tracked, not secrets)
        │   └── phase-1-execution-plan.md
        └── design/
```

---

## Task 1: Install and Configure Wrangler

### 1.1 Check Current Wrangler Status

**Objective**: Verify if Wrangler is already available

```bash
# Check if Wrangler is in project dependencies
pnpm list wrangler

# Check if Wrangler is installed globally
which wrangler || echo "Not installed globally"

# If available, check version
pnpm wrangler --version
```

**Expected output**:
```
@portfolio/service wrangler 4.42.0
```

### 1.2 Install Wrangler Globally (Optional)

**Objective**: Install Wrangler globally for easier CLI access

```bash
# Option 1: Install globally (recommended for Phase 1)
pnpm add -g wrangler

# Verify global installation
wrangler --version

# Option 2: Use project's Wrangler via pnpm
# Throughout this plan, use: pnpm wrangler <command>
```

**Note**: For this plan, we'll use `wrangler` assuming global install. If using project version, prefix with `pnpm`.

### 1.3 Authenticate with Cloudflare

**Objective**: Link Wrangler to your Cloudflare account

```bash
# Login to Cloudflare
wrangler login

# This will:
# 1. Open browser for OAuth authentication
# 2. Grant Wrangler access to your account
# 3. Store credentials in ~/.wrangler/config/

# Verify authentication
wrangler whoami
```

**Expected output**:
```
 ⛅️ wrangler 4.42.0
-------------------
Getting User settings...
👋 You are logged in with an OAuth Token!
┌──────────────────────┬──────────────────────────────────┐
│ Account Name         │ Account ID                       │
├──────────────────────┼──────────────────────────────────┤
│ <Your Account>       │ <account-id>                     │
└──────────────────────┴──────────────────────────────────┘
```

**✅ Deliverable**: Wrangler CLI authenticated and ready

---

## Task 2: Create Cloudflare Resources (CLI)

### 2.1 Create D1 Databases

**Objective**: Create SQLite databases for all environments

```bash
# Development database
wrangler d1 create portfolio-dev

# Staging database
wrangler d1 create portfolio-staging

# Production database
wrangler d1 create portfolio-prod
```

**Expected output** (for each):
```
✅ Successfully created DB 'portfolio-dev' in region WNAM

[[d1_databases]]
binding = "DB"
database_name = "portfolio-dev"
database_id = "xxxx-xxxx-xxxx-xxxx"
```

**⚠️ Important**: Copy the `database_id` from each output - you'll need them for wrangler.jsonc

### 2.2 Create Vectorize Indexes

**Objective**: Create vector search indexes for embeddings

```bash
# Development index
wrangler vectorize create portfolio-embeddings-dev \
  --dimensions=1536 \
  --metric=cosine

# Staging index
wrangler vectorize create portfolio-embeddings-staging \
  --dimensions=1536 \
  --metric=cosine

# Production index
wrangler vectorize create portfolio-embeddings-prod \
  --dimensions=1536 \
  --metric=cosine
```

**Expected output** (for each):
```
✅ Successfully created index 'portfolio-embeddings-dev'

[[vectorize]]
binding = "VECTORIZE"
index_name = "portfolio-embeddings-dev"
```

**Note**: Vectorize doesn't return an ID - the index_name is used directly in wrangler.jsonc

### 2.3 Create R2 Buckets

**Objective**: Create object storage for documents

```bash
# Development bucket
wrangler r2 bucket create portfolio-documents-dev

# Staging bucket
wrangler r2 bucket create portfolio-documents-staging

# Production bucket
wrangler r2 bucket create portfolio-documents-prod
```

**Expected output** (for each):
```
 ⛅️ wrangler 4.42.0
-------------------
✅ Created bucket 'portfolio-documents-dev' with default storage class set to 'Standard'.
```

**Verify buckets**:
```bash
wrangler r2 bucket list
```

### 2.4 Create Queues

**Objective**: Create message queues for async document processing

```bash
# Development queue
wrangler queues create portfolio-doc-processing-dev

# Development dead letter queue
wrangler queues create portfolio-doc-processing-dev-dlq

# Staging queue
wrangler queues create portfolio-doc-processing-staging

# Staging dead letter queue
wrangler queues create portfolio-doc-processing-staging-dlq

# Production queue
wrangler queues create portfolio-doc-processing-prod

# Production dead letter queue
wrangler queues create portfolio-doc-processing-prod-dlq
```

**Expected output** (for each):
```
✅ Created queue 'portfolio-doc-processing-dev'

[[queues.producers]]
binding = "QUEUE"
queue = "portfolio-doc-processing-dev"
```

**Verify queues**:
```bash
wrangler queues list
```

**Note**: Dead letter queues (DLQ) are used to capture messages that fail processing after max retries.

### 2.5 Document Resource IDs

**Objective**: Store all resource IDs for configuration

Create a tracking file:

```bash
# Create the tracking file
cat > docs/cloudflare-migration/execution-plans/phase-1-resources.json << 'EOF'
{
  "d1_databases": {
    "dev": {
      "database_name": "portfolio-dev",
      "database_id": "<INSERT-DEV-DATABASE-ID>"
    },
    "staging": {
      "database_name": "portfolio-staging",
      "database_id": "<INSERT-STAGING-DATABASE-ID>"
    },
    "prod": {
      "database_name": "portfolio-prod",
      "database_id": "<INSERT-PROD-DATABASE-ID>"
    }
  },
  "vectorize_indexes": {
    "dev": "portfolio-embeddings-dev",
    "staging": "portfolio-embeddings-staging",
    "prod": "portfolio-embeddings-prod"
  },
  "r2_buckets": {
    "dev": "portfolio-documents-dev",
    "staging": "portfolio-documents-staging",
    "prod": "portfolio-documents-prod"
  },
  "queues": {
    "dev": "portfolio-doc-processing-dev",
    "dev_dlq": "portfolio-doc-processing-dev-dlq",
    "staging": "portfolio-doc-processing-staging",
    "staging_dlq": "portfolio-doc-processing-staging-dlq",
    "prod": "portfolio-doc-processing-prod",
    "prod_dlq": "portfolio-doc-processing-prod-dlq"
  }
}
EOF
```

**Then fill in the actual database IDs** from the CLI output above.

**✅ Deliverable**: All Cloudflare resources created and IDs documented

---

## Task 3: Create Database Schema and Migrations

### 3.1 Create Migration Directory Structure

**Objective**: Set up D1 migrations directory

```bash
# Create directory structure
mkdir -p apps/database/migrations

# Create README
cat > apps/database/README.md << 'EOF'
# Database Migrations

This directory contains D1 database migration scripts.

## Running Migrations

```bash
# Local database
wrangler d1 execute portfolio-dev \
  --local \
  --file=apps/database/migrations/0001_initial_schema.sql

# Remote dev database
wrangler d1 execute portfolio-dev \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql
```

## Migration Files

- `0001_initial_schema.sql` - Initial schema (companies, documents, chunks tables)
- `0002_test_data.sql` - Test data for development

## Schema Documentation

See `docs/cloudflare-migration/design/database-schema.md` for detailed schema design.
EOF
```

### 3.2 Create Initial Schema Migration

**File**: `apps/database/migrations/0001_initial_schema.sql`

```bash
cat > apps/database/migrations/0001_initial_schema.sql << 'EOF'
-- ============================================
-- Portfolio RAG System - Initial Schema
-- Migration: 0001
-- Created: 2025-11-02
-- ============================================

-- Companies Table
-- Stores work experience information
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_time TEXT NOT NULL,  -- ISO 8601 date: "2023-01-15"
  end_time TEXT,              -- NULL for current role
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documents Table
-- Stores metadata for documents in R2
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_hash TEXT NOT NULL UNIQUE,
  company_id INTEGER NOT NULL,
  project TEXT NOT NULL UNIQUE,
  tags TEXT NOT NULL,             -- JSON array: ["tag1", "tag2"]
  r2_key TEXT NOT NULL,           -- R2 object key
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Chunks Table
-- Stores document chunks with their content
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,          -- Full chunk text
  document_id INTEGER NOT NULL,
  type TEXT NOT NULL,             -- 'markdown', 'json', etc.
  tags TEXT NOT NULL,             -- JSON array: ["tag1", "tag2"]
  vectorize_id TEXT NOT NULL UNIQUE,  -- Links to Vectorize
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- ============================================
-- Indexes for Query Performance
-- ============================================

-- Chunks indexes
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tags ON chunks(tags);
CREATE INDEX IF NOT EXISTS idx_chunks_vectorize_id ON chunks(vectorize_id);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents(tags);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- ============================================
-- Verification Queries
-- ============================================

-- ============================================
-- D1 Notes
-- ============================================

-- D1 enforces foreign keys by default (cannot be disabled)
-- This is different from standard SQLite where PRAGMA foreign_keys must be set

-- List all tables
-- SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Check schema
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='companies';
EOF
```

### 3.3 Apply Migration to Local Databases

**Objective**: Create schema in local D1 databases for development

```bash
# Apply to local dev database
wrangler d1 execute portfolio-dev \
  --local \
  --file=apps/database/migrations/0001_initial_schema.sql

# Verify tables were created
wrangler d1 execute portfolio-dev \
  --local \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

**Expected output**:
```
🌀 Mapping SQL input into an array of statements
🌀 Executing on local database portfolio-dev (xxxx-xxxx-xxxx-xxxx) from .wrangler/state/v3/d1:
┌──────────┐
│ name     │
├──────────┤
│ chunks   │
│ companies│
│ documents│
└──────────┘
```

### 3.4 Apply Migration to Remote Databases

**Objective**: Create schema in Cloudflare D1 databases

```bash
# Development (remote)
wrangler d1 execute portfolio-dev \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql

# Verify
wrangler d1 execute portfolio-dev \
  --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table';"

# Staging (remote)
wrangler d1 execute portfolio-staging \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql

# Production (remote)
wrangler d1 execute portfolio-prod \
  --remote \
  --file=apps/database/migrations/0001_initial_schema.sql
```

### 3.5 Create Test Data Migration

**File**: `apps/database/migrations/0002_test_data.sql`

```bash
cat > apps/database/migrations/0002_test_data.sql << 'EOF'
-- ============================================
-- Test Data for Development
-- Migration: 0002
-- ============================================

-- Test Company
INSERT INTO companies (name, start_time, end_time, title, description)
VALUES (
  'Test Company Inc',
  '2023-01-01',
  '2024-12-31',
  'Senior Software Engineer',
  'Sample company for development and testing purposes'
);

-- Test Document
INSERT INTO documents (content_hash, company_id, project, tags, r2_key)
VALUES (
  'test-hash-' || hex(randomblob(16)),
  1,
  'test/sample-document',
  '["testing", "development", "sample"]',
  'documents/test/sample-document.md'
);

-- Test Chunks
INSERT INTO chunks (content, document_id, type, tags, vectorize_id)
VALUES
  (
    'This is a test chunk for validation. It demonstrates the database schema working correctly.',
    1,
    'markdown',
    '["testing", "sample"]',
    'test-doc-1-chunk-0'
  ),
  (
    'Another test chunk to verify multiple chunks per document work as expected.',
    1,
    'markdown',
    '["testing", "validation"]',
    'test-doc-1-chunk-1'
  );

-- Verification query
SELECT
  co.name as company,
  d.project,
  COUNT(ch.id) as chunk_count
FROM companies co
JOIN documents d ON d.company_id = co.id
JOIN chunks ch ON ch.document_id = d.id
GROUP BY co.id, d.id;
EOF
```

### 3.6 Apply Test Data (Local Only)

```bash
# Apply test data to local dev database
wrangler d1 execute portfolio-dev \
  --local \
  --file=apps/database/migrations/0002_test_data.sql

# Verify data
wrangler d1 execute portfolio-dev \
  --local \
  --command="SELECT COUNT(*) as count FROM companies;"
```

**Expected output**: `count: 1`

**✅ Deliverable**: D1 schema created in all databases, test data in local dev

---

## Task 4: Configure Infrastructure as Code (wrangler.jsonc)

### 4.1 Create Document Processor Configuration

**Objective**: Create wrangler.jsonc for the document processor worker (Phase 4)

```bash
# Create directory
mkdir -p apps/document-processor/src

# Create wrangler.jsonc
cat > apps/document-processor/wrangler.jsonc << 'EOF'
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "portfolio-document-processor",
  "main": "src/index.ts",
  "compatibility_date": "2025-10-28",
  "compatibility_flags": ["nodejs_compat_v2"],

  // ============================================================================
  // Bindings - Default (Development)
  // ============================================================================

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "portfolio-dev",
      "database_id": "<INSERT-DEV-DATABASE-ID>"
    }
  ],

  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "portfolio-embeddings-dev"
    }
  ],

  "r2_buckets": [
    {
      "binding": "DOCUMENTS",
      "bucket_name": "portfolio-documents-dev"
    }
  ],

  "queues": {
    "producers": [
      {
        "binding": "QUEUE",
        "queue": "portfolio-doc-processing-dev"
      }
    ],
    "consumers": [
      {
        "queue": "portfolio-doc-processing-dev",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "portfolio-doc-processing-dev-dlq"
      }
    ]
  },

  // Note: Durable Objects bindings will be added in Phase 4 when the DocumentProcessor class is implemented

  "vars": {
    "ENVIRONMENT": "development"
  },

  // ============================================================================
  // Environment-Specific Overrides
  // ============================================================================

  "env": {
    "staging": {
      "name": "portfolio-document-processor-staging",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "portfolio-staging",
          "database_id": "<INSERT-STAGING-DATABASE-ID>"
        }
      ],
      "vectorize": [
        {
          "binding": "VECTORIZE",
          "index_name": "portfolio-embeddings-staging"
        }
      ],
      "r2_buckets": [
        {
          "binding": "DOCUMENTS",
          "bucket_name": "portfolio-documents-staging"
        }
      ],
      "queues": {
        "producers": [
          {
            "binding": "QUEUE",
            "queue": "portfolio-doc-processing-staging"
          }
        ],
        "consumers": [
          {
            "queue": "portfolio-doc-processing-staging",
            "max_batch_size": 10,
            "max_batch_timeout": 30,
            "max_retries": 3,
            "dead_letter_queue": "portfolio-doc-processing-staging-dlq"
          }
        ]
      },
      "vars": {
        "ENVIRONMENT": "staging"
      }
    },
    "production": {
      "name": "portfolio-document-processor-prod",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "portfolio-prod",
          "database_id": "<INSERT-PROD-DATABASE-ID>"
        }
      ],
      "vectorize": [
        {
          "binding": "VECTORIZE",
          "index_name": "portfolio-embeddings-prod"
        }
      ],
      "r2_buckets": [
        {
          "binding": "DOCUMENTS",
          "bucket_name": "portfolio-documents-prod"
        }
      ],
      "queues": {
        "producers": [
          {
            "binding": "QUEUE",
            "queue": "portfolio-doc-processing-prod"
          }
        ],
        "consumers": [
          {
            "queue": "portfolio-doc-processing-prod",
            "max_batch_size": 10,
            "max_batch_timeout": 30,
            "max_retries": 3,
            "dead_letter_queue": "portfolio-doc-processing-prod-dlq"
          }
        ]
      },
      "vars": {
        "ENVIRONMENT": "production"
      }
    }
  }
}
EOF
```

**Then replace placeholders**:
- Update `<INSERT-DEV-DATABASE-ID>` with actual ID from Task 2.5
- Update `<INSERT-STAGING-DATABASE-ID>`
- Update `<INSERT-PROD-DATABASE-ID>`

### 4.2 Update Service Configuration

**Objective**: Add Cloudflare bindings to existing service

**Edit**: `apps/service/wrangler.jsonc`

Update the file to add Cloudflare bindings. The `version_metadata` section should be followed by a comma, then add:

```jsonc
  "version_metadata": {
    "binding": "CF_VERSION_METADATA"
  },

  // ============================================================================
  // Cloudflare Bindings (Migration Phase 5)
  // ============================================================================

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "portfolio-dev",
      "database_id": "<INSERT-DEV-DATABASE-ID>"
    }
  ],

  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "portfolio-embeddings-dev"
    }
  ],

  "r2_buckets": [
    {
      "binding": "DOCUMENTS",
      "bucket_name": "portfolio-documents-dev"
    }
  ],

  "vars": {
    "ENVIRONMENT": "development"
  },

  // ============================================================================
  // Environment-Specific Configuration
  // ============================================================================

  "env": {
    "staging": {
      "name": "chat-service-staging",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "portfolio-staging",
          "database_id": "<INSERT-STAGING-DATABASE-ID>"
        }
      ],
      "vectorize": [
        {
          "binding": "VECTORIZE",
          "index_name": "portfolio-embeddings-staging"
        }
      ],
      "r2_buckets": [
        {
          "binding": "DOCUMENTS",
          "bucket_name": "portfolio-documents-staging"
        }
      ],
      "vars": {
        "ENVIRONMENT": "staging"
      }
    },
    "production": {
      "name": "chat-service-prod",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "portfolio-prod",
          "database_id": "<INSERT-PROD-DATABASE-ID>"
        }
      ],
      "vectorize": [
        {
          "binding": "VECTORIZE",
          "index_name": "portfolio-embeddings-prod"
        }
      ],
      "r2_buckets": [
        {
          "binding": "DOCUMENTS",
          "bucket_name": "portfolio-documents-prod"
        }
      ],
      "vars": {
        "ENVIRONMENT": "production"
      }
    }
  }
```

**Then replace all database ID placeholders** with actual values.

### 4.3 Commit Configuration Files

**Objective**: Version control the IaC configuration

```bash
# Add files to git
git add apps/document-processor/wrangler.jsonc
git add apps/service/wrangler.jsonc
git add apps/database/
git add docs/cloudflare-migration/execution-plans/phase-1-resources.json

# Commit
git commit -m "feat(infra): Phase 1 - Infrastructure as Code configuration

- Add D1 databases for all environments
- Add Vectorize indexes for vector search
- Add R2 buckets for document storage
- Add Queues for async processing
- Configure document processor bindings
- Update service with Cloudflare bindings
- Add D1 migration scripts (initial schema + test data)

Resource IDs are safe to commit (not secrets).
"
```

**✅ Deliverable**: All infrastructure defined as code in wrangler.jsonc files

---

## Task 5: Set Up Local Development Environment

### 5.1 Test Local D1 Access

**Objective**: Verify local D1 database works

```bash
# Query local D1
wrangler d1 execute portfolio-dev \
  --local \
  --command="SELECT COUNT(*) as tables FROM sqlite_master WHERE type='table';"

# Expected: 3 tables (companies, documents, chunks)

# Test JOIN query
wrangler d1 execute portfolio-dev \
  --local \
  --command="SELECT c.name, d.project FROM companies c JOIN documents d ON d.company_id = c.id;"
```

### 5.2 Test Local Wrangler Dev Mode

**Objective**: Start service with local bindings

```bash
# Navigate to service
cd apps/service

# Start dev server with local bindings
pnpm dev

# In another terminal, test health endpoint
curl http://localhost:5173/
```

**Expected output**: Service starts and responds to requests

**Note**: The D1, Vectorize, and R2 bindings won't be functional until Phase 5, but the service should start without errors.

### 5.3 Create Development Helper Scripts

**File**: `scripts/dev-local.sh`

```bash
cat > scripts/dev-local.sh << 'EOF'
#!/bin/bash
# Local development environment startup

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
EOF

chmod +x scripts/dev-local.sh
```

**File**: `scripts/deploy.sh`

```bash
cat > scripts/deploy.sh << 'EOF'
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
EOF

chmod +x scripts/deploy.sh
```

**✅ Deliverable**: Local development environment configured and tested

---

## Task 6: Configure Secrets

### 6.1 Set OpenAI API Key

**Objective**: Configure OpenAI API key as Worker secret

```bash
# Set secret for document processor (Phase 4)
wrangler secret put OPENAI_API_KEY \
  --name portfolio-document-processor

# You'll be prompted to enter the key
# Paste your OpenAI API key and press Enter

# For staging
wrangler secret put OPENAI_API_KEY \
  --name portfolio-document-processor \
  --env staging

# For production
wrangler secret put OPENAI_API_KEY \
  --name portfolio-document-processor \
  --env production
```

### 6.2 Create Local Environment Variables File

**Objective**: Configure local development secrets

```bash
# Create .dev.vars in document-processor
cat > apps/document-processor/.dev.vars << 'EOF'
# Local development environment variables
# NEVER commit this file to version control

OPENAI_API_KEY=sk-proj-...your-key-here...
ENVIRONMENT=development
EOF

# Add to .gitignore if not already there
echo "" >> .gitignore
echo "# Local development secrets" >> .gitignore
echo "**/.dev.vars" >> .gitignore
```

**Note**: The service already has secrets configured via Supabase. These will be updated in Phase 5.

### 6.3 Document Secrets Management

**Create**: `docs/cloudflare-migration/execution-plans/secrets-management.md`

```bash
cat > docs/cloudflare-migration/execution-plans/secrets-management.md << 'EOF'
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
# Document processor
wrangler secret put OPENAI_API_KEY --name portfolio-document-processor

# Staging
wrangler secret put OPENAI_API_KEY --name portfolio-document-processor --env staging

# Production
wrangler secret put OPENAI_API_KEY --name portfolio-document-processor --env production
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
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Worker write permissions
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `OPENAI_API_KEY`: OpenAI API key

## Storing Sensitive Data Locally

For personal reference (NOT in repository), store sensitive data at:
`/Users/lix/Documents/Obsidian/Notes/Notes/Portfolio/Secrets.md`

This includes:
- API tokens
- Account IDs
- Any credentials you need to reference
EOF
```

**✅ Deliverable**: Secrets configured for all environments

---

## Task 7: Set Up CI/CD Integration

### 7.1 Get Cloudflare Account ID

```bash
# Get your account ID
wrangler whoami

# Copy the Account ID from the output
```

### 7.2 Generate Cloudflare API Token

**Option 1: Via Wrangler (Recommended)**

```bash
# This will guide you through token creation
wrangler login

# Then get the token from Cloudflare dashboard
# or create a new one with specific permissions
```

**Option 2: Via Dashboard**

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Scope to your account
5. Copy the token

**⚠️ Store this token securely** - you'll need it for GitHub Actions

### 7.3 Configure GitHub Actions Secrets

Go to your GitHub repository:
1. Navigate to **Settings → Secrets and variables → Actions**
2. Click "New repository secret"
3. Add these secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `CLOUDFLARE_API_TOKEN` | From Step 7.2 | API token with Worker write access |
| `CLOUDFLARE_ACCOUNT_ID` | From Step 7.1 | Your Cloudflare account ID |
| `OPENAI_API_KEY` | Your OpenAI key | For embedding generation |

### 7.4 Create GitHub Actions Workflow Placeholder

**File**: `.github/workflows/deploy-cloudflare.yml`

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - main
      - staging
  workflow_dispatch:

jobs:
  # Placeholder - will be implemented in Phase 8
  deploy:
    runs-on: ubuntu-latest
    name: Verify Configuration
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install

      - name: Verify Phase 1 setup
        run: |
          echo "✅ Phase 1 configuration verified"
          echo "📦 wrangler.jsonc files:"
          find apps -name "wrangler.jsonc" -type f
          echo ""
          echo "📄 D1 migrations:"
          find apps/database/migrations -name "*.sql" -type f
          echo ""
          echo "🚀 Full deployment will be enabled in Phase 8"

# Secrets required (configured in GitHub repository settings):
# - CLOUDFLARE_API_TOKEN
# - CLOUDFLARE_ACCOUNT_ID
# - OPENAI_API_KEY
```

Commit the workflow:

```bash
git add .github/workflows/deploy-cloudflare.yml
git commit -m "ci: Add Cloudflare deployment workflow placeholder"
```

**✅ Deliverable**: CI/CD configured and ready for Phase 8

---

## Task 8: Verification and Testing

### 8.1 Create Comprehensive Verification Script

**File**: `scripts/verify-phase-1.sh`

```bash
cat > scripts/verify-phase-1.sh << 'EOF'
#!/bin/bash
# Phase 1 Infrastructure Verification Script

set -e

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
check "Wrangler installed" "command -v wrangler || pnpm wrangler --version"
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
  --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('companies', 'documents', 'chunks');" 2>&1 | grep -Eo '[0-9]+' | tail -1 || echo "0")

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
check "Staging queue exists" "wrangler queues list | grep -q 'portfolio-doc-processing-staging'"
check "Production queue exists" "wrangler queues list | grep -q 'portfolio-doc-processing-prod'"
echo ""

# 6. Check File Structure
echo "6️⃣  File Structure"
check "Database migrations directory" "test -d apps/database/migrations"
check "Initial schema migration" "test -f apps/database/migrations/0001_initial_schema.sql"
check "Test data migration" "test -f apps/database/migrations/0002_test_data.sql"
check "Document processor config" "test -f apps/document-processor/wrangler.jsonc"
check "Service config updated" "grep -q 'd1_databases' apps/service/wrangler.jsonc"
check "Resource IDs documented" "test -f docs/cloudflare-migration/execution-plans/phase-1-resources.json"
echo ""

# 7. Check Configuration
echo "7️⃣  Infrastructure as Code"
echo -n "Checking database IDs in configs... "
if grep -q '<INSERT-DEV-DATABASE-ID>' apps/document-processor/wrangler.jsonc 2>/dev/null; then
  echo -e "${YELLOW}⚠ Placeholders still present${NC}"
else
  echo -e "${GREEN}✓${NC}"
fi

echo -n "Checking service config... "
if grep -q '<INSERT-DEV-DATABASE-ID>' apps/service/wrangler.jsonc 2>/dev/null; then
  echo -e "${YELLOW}⚠ Placeholders still present${NC}"
else
  echo -e "${GREEN}✓${NC}"
fi
echo ""

# 8. Check Secrets
echo "8️⃣  Secrets Configuration"
check ".dev.vars in .gitignore" "grep -q '.dev.vars' .gitignore"
check "Secrets documentation" "test -f docs/cloudflare-migration/execution-plans/secrets-management.md"
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
else
  echo -e "${RED}❌ Phase 1 Verification Failed - $ERRORS error(s) found${NC}"
  echo ""
  echo "Please fix the errors above before proceeding to Phase 2"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EOF

chmod +x scripts/verify-phase-1.sh
```

### 8.2 Run Verification

```bash
# Run the verification script
./scripts/verify-phase-1.sh
```

Review the output and address any failures.

### 8.3 Test Data Validation

```bash
# Test JOIN query on local database
wrangler d1 execute portfolio-dev \
  --local \
  --command="
SELECT
  c.name as company,
  d.project,
  COUNT(ch.id) as chunks
FROM companies c
JOIN documents d ON d.company_id = c.id
JOIN chunks ch ON ch.document_id = d.id
GROUP BY c.id, d.id;"
```

**Expected output**:
```
┌──────────────────┬─────────────────────┬────────┐
│ company          │ project             │ chunks │
├──────────────────┼─────────────────────┼────────┤
│ Test Company Inc │ test/sample-document│ 2      │
└──────────────────┴─────────────────────┴────────┘
```

### 8.4 Test Local Development Server

```bash
# Start local dev server
./scripts/dev-local.sh

# In another terminal, test the service
curl http://localhost:5173/

# Stop the server (Ctrl+C)
```

**✅ Deliverable**: All verification checks passing

---

## Task 9: Documentation and Handoff

### 9.1 Create Phase 1 Completion Report

**File**: `docs/cloudflare-migration/execution-plans/phase-1-completion-report.md`

```bash
cat > docs/cloudflare-migration/execution-plans/phase-1-completion-report.md << 'EOF'
# Phase 1 Completion Report

**Date**: <YYYY-MM-DD>
**Duration**: <X days>
**Status**: ✅ Complete

---

## Summary

Phase 1: Infrastructure Setup has been completed successfully. All Cloudflare resources are provisioned, configured as code, and ready for development.

## Deliverables Checklist

- [x] Wrangler CLI installed and authenticated
- [x] 3 D1 databases created (dev, staging, prod)
- [x] 3 Vectorize indexes created (1536 dim, cosine metric)
- [x] 3 R2 buckets created
- [x] 3 Queues created
- [x] Database schema created and applied to all environments
- [x] Test data inserted in local dev database
- [x] Infrastructure as Code: wrangler.jsonc files created
- [x] Resource IDs documented and committed
- [x] Secrets configured for all environments
- [x] CI/CD secrets configured in GitHub
- [x] Helper scripts created (dev, deploy, verify)
- [x] All verification checks passing

## Resources Created

### D1 Databases
- `portfolio-dev` (ID: xxxx-xxxx-xxxx-xxxx)
- `portfolio-staging` (ID: yyyy-yyyy-yyyy-yyyy)
- `portfolio-prod` (ID: zzzz-zzzz-zzzz-zzzz)

### Vectorize Indexes
- `portfolio-embeddings-dev` (1536 dimensions, cosine metric)
- `portfolio-embeddings-staging`
- `portfolio-embeddings-prod`

### R2 Buckets
- `portfolio-documents-dev`
- `portfolio-documents-staging`
- `portfolio-documents-prod`

### Queues
- `portfolio-doc-processing-dev`
- `portfolio-doc-processing-staging`
- `portfolio-doc-processing-prod`

## Files Created/Modified

**New Files:**
```
apps/database/
  migrations/
    0001_initial_schema.sql
    0002_test_data.sql
  README.md
apps/document-processor/
  wrangler.jsonc
  .dev.vars (gitignored)
scripts/
  dev-local.sh
  deploy.sh
  verify-phase-1.sh
docs/cloudflare-migration/execution-plans/
  phase-1-resources.json
  secrets-management.md
  phase-1-completion-report.md
.github/workflows/
  deploy-cloudflare.yml
```

**Modified Files:**
```
apps/service/wrangler.jsonc (added D1, Vectorize, R2 bindings)
.gitignore (added .dev.vars)
```

## Verification Results

All verification checks passed:
```
✓ Wrangler CLI operational
✓ 3 D1 databases with schema
✓ 3 Vectorize indexes
✓ 3 R2 buckets
✓ 3 Queues
✓ File structure complete
✓ IaC configuration valid
✓ Secrets configured
✓ Scripts executable
```

## Next Steps

**Ready for Phase 2: R2 Sync Client**

Reference: `docs/cloudflare-migration/02-implementation-plan.md#phase-2`

**Objectives:**
1. Build CLI tool to sync local documents to R2
2. Implement change detection (SHA-256 hashing)
3. Create CI/CD integration for automatic sync
4. Upload all existing documents to R2

**Estimated Duration**: 1 week

## Lessons Learned

<Add any insights, challenges, or notes from Phase 1 execution>

## Issues Encountered

<Document any issues and their resolutions>

---

**Phase 1 Sign-off**: ✅ Infrastructure ready for Phase 2
EOF
```

### 9.2 Update Implementation Plan

**Edit**: `docs/cloudflare-migration/02-implementation-plan.md`

Mark Phase 1 tasks as complete:

```markdown
## Phase 1: Infrastructure Setup (Week 1) ✅

### Tasks

1. **Create Cloudflare resources** ✅
   - [x] Create D1 database (dev, staging, production)
   - [x] Create Vectorize index
   - [x] Create R2 bucket
   - [x] Create Queue for document processing
   - [x] Configure Durable Objects namespace

2. **Database schema** ✅
   - [x] Run D1 migration scripts
   - [x] Create tables: companies, documents, chunks
   - [x] Create indexes
   - [x] Verify schema with test data

3. **Development environment** ✅
   - [x] Install Wrangler CLI
   - [x] Configure local D1 instance
   - [x] Set up Miniflare for testing
   - [x] Configure environment variables

4. **Access control** ✅
   - [x] Create API tokens
   - [x] Configure permissions
   - [x] Set up CI/CD secrets
```

### 9.3 Commit All Changes

```bash
# Stage all Phase 1 files
git add -A

# Commit with detailed message
git commit -m "feat: Complete Phase 1 - Infrastructure Setup

COMPLETED:
✅ All Cloudflare resources provisioned
✅ Infrastructure as Code configuration
✅ D1 schema and migrations
✅ Local development environment
✅ CI/CD integration configured
✅ Comprehensive verification scripts

RESOURCES CREATED:
- 3 D1 databases (dev, staging, prod)
- 3 Vectorize indexes (1536 dim, cosine)
- 3 R2 buckets for document storage
- 3 Queues for async processing

NEW FILES:
- apps/database/migrations/ (D1 schema)
- apps/document-processor/wrangler.jsonc
- scripts/*.sh (dev, deploy, verify)
- Phase 1 completion report and docs

NEXT: Phase 2 - R2 Sync Client

Closes #<issue-number-if-applicable>
"

# Push to remote
git push origin cloudflare-db
```

**✅ Deliverable**: Phase 1 fully documented and ready for review

---

## Success Criteria Summary

Phase 1 is complete when ALL of the following are true:

### Infrastructure
- [ ] Wrangler CLI installed and authenticated
- [ ] 3 D1 databases created and accessible
- [ ] 3 Vectorize indexes created (1536 dims, cosine)
- [ ] 3 R2 buckets created
- [ ] 3 Queues created
- [ ] All resources listed in `wrangler <resource-type> list`

### Database
- [ ] Initial schema migration created and applied
- [ ] 3 tables exist: companies, documents, chunks
- [ ] 8 indexes created for performance
- [ ] Foreign key constraints working
- [ ] Test data inserted in local dev database
- [ ] Can execute JOIN queries successfully

### Configuration
- [ ] `apps/document-processor/wrangler.jsonc` created
- [ ] `apps/service/wrangler.jsonc` updated with bindings
- [ ] All database IDs filled in (no placeholders)
- [ ] Environment-specific configs (dev, staging, prod)
- [ ] `phase-1-resources.json` created and accurate
- [ ] All configurations committed to git

### Secrets
- [ ] `OPENAI_API_KEY` set for document-processor (all envs)
- [ ] `.dev.vars` created for local development
- [ ] `.dev.vars` added to `.gitignore`
- [ ] Secrets documentation created
- [ ] GitHub Actions secrets configured

### Development Environment
- [ ] Can start local dev server (`./scripts/dev-local.sh`)
- [ ] Can query local D1 database
- [ ] Helper scripts created and executable
- [ ] Verification script passes all checks

### Documentation
- [ ] Resource IDs documented
- [ ] Secrets management documented
- [ ] Phase 1 completion report created
- [ ] Implementation plan updated with checkmarks
- [ ] All changes committed to version control

### Verification
- [ ] `./scripts/verify-phase-1.sh` passes all checks
- [ ] No placeholder values (`<INSERT-...>`) remain in configs
- [ ] Can execute D1 queries on all databases
- [ ] All resources visible in Cloudflare dashboard

---

## Timeline Estimate

| Task | Time | Total |
|------|------|-------|
| 1. Install & configure Wrangler | 15 min | 15 min |
| 2. Create resources (CLI) | 30 min | 45 min |
| 3. Database schema & migrations | 45 min | 1h 30m |
| 4. IaC configuration (wrangler.jsonc) | 45 min | 2h 15m |
| 5. Local dev environment | 30 min | 2h 45m |
| 6. Configure secrets | 20 min | 3h 05m |
| 7. CI/CD integration | 25 min | 3h 30m |
| 8. Verification & testing | 30 min | 4h 00m |
| 9. Documentation | 45 min | 4h 45m |

**Total Estimated Time**: ~5 hours for experienced developer

**Note**: First-time Cloudflare users may need additional time for account setup and learning Wrangler CLI.

---

## Troubleshooting

### Common Issues

#### 1. Wrangler Login Fails
```bash
# Clear credentials and retry
rm -rf ~/.wrangler
wrangler login
```

#### 2. D1 Database Creation Quota Exceeded
```bash
# Check existing databases
wrangler d1 list

# Delete unused databases
wrangler d1 delete <database-name>
```

#### 3. Vectorize Not Available
- Vectorize requires Workers Paid plan
- Enable in Cloudflare dashboard → Workers → Vectorize

#### 4. Local D1 Commands Fail
```bash
# Ensure using --local flag
wrangler d1 execute portfolio-dev --local --command="SELECT 1;"

# Clear local state if corrupted
rm -rf .wrangler/state
```

#### 5. Placeholder Values Still in Config
```bash
# Search for placeholders
grep -r "<INSERT-" apps/*/wrangler.jsonc

# Update with actual IDs from phase-1-resources.json
```

#### 6. Cannot Set Secrets
```bash
# Ensure worker name matches wrangler.jsonc "name" field
wrangler secret list --name portfolio-document-processor

# Check if authenticated
wrangler whoami
```

---

## Related Documents

- [Implementation Plan](../02-implementation-plan.md) - Full migration timeline
- [High-Level Design](../01-high-level-design.md) - Architecture overview
- [Database Schema Design](../design/database-schema.md) - Detailed schema spec
- [Phase 2: R2 Sync Client](./phase-2-execution-plan.md) - Next phase (to be created)

---

## Notes

- All resource names follow pattern: `portfolio-<resource>-<environment>`
- Database IDs are permanent - store them carefully
- Secrets NEVER go in wrangler.jsonc - use `wrangler secret put`
- Local D1 data stored in `.wrangler/state/` (gitignored)
- Use `--remote` flag to access Cloudflare D1 (not local)
- Resource IDs (not secrets) can be safely committed to git

---

**End of Phase 1 Execution Plan**
