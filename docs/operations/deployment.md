# Deployment Strategy

**Version**: 1.0
**Last Updated**: November 1, 2025

---

## Overview

This document outlines the deployment strategy for the Cloudflare migration, including environment setup, rollout phases, and rollback procedures.

---

## Environment Setup

### Development

**Purpose**: Local development and testing

**Configuration**:
```jsonc
// wrangler.jsonc (dev)
{
  "name": "portfolio-service-dev",
  "compatibility_date": "2024-01-01",

  "env": {
    "dev": {
      "vars": { "ENVIRONMENT": "development" },

      // Use local bindings
      "d1_databases": [{
        "binding": "DB",
        "database_name": "portfolio-db",
        "database_id": "local"  // Local D1 instance
      }]
    }
  }
}
```

**Tools**:
- `wrangler dev` for local Workers
- Miniflare for local testing
- Local D1 database
- Mock Vectorize for testing

### Staging

**Purpose**: Pre-production testing and validation

**Configuration**:
```jsonc
// wrangler.jsonc (staging)
{
  "env": {
    "staging": {
      "vars": { "ENVIRONMENT": "staging" },

      "d1_databases": [{
        "binding": "DB",
        "database_name": "portfolio-db-staging",
        "database_id": "xxx-staging"
      }],

      "vectorize": [{
        "binding": "VECTORIZE",
        "index_name": "portfolio-embeddings-staging"
      }]
    }
  }
}
```

**Characteristics**:
- Production-like setup
- Separate D1 database
- Separate Vectorize index
- Test data only

### Production

**Purpose**: Live user traffic

**Configuration**:
```bash
[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "portfolio-db"
database_id = "xxx-production"

[[env.production.vectorize]]
binding = "VECTORIZE"
index_name = "portfolio-embeddings"
```

---

## Deployment Commands

### Deploy to Staging

```bash
# Build and deploy document processor
cd apps/document-processor
pnpm build
wrangler deploy --env staging

# Deploy reconciliation worker
cd apps/r2-reconciliation
wrangler deploy --env staging

# Deploy query service
cd apps/service
pnpm build
wrangler deploy --env staging
```

### Deploy to Production

```bash
# Same commands with production env
wrangler deploy --env production
```

### Rollback

```bash
# Rollback to previous deployment
wrangler rollback --env production

# Or redeploy specific version
wrangler versions list
wrangler versions deploy <version-id>
```

---

## Rollout Plan

### Phase 1: Dual-Run (Week 10)

**Goal**: Run both Supabase and Cloudflare stacks in parallel

**Actions**:
1. Deploy all Cloudflare components to production
2. Keep Supabase operational
3. Route 10% of traffic to new stack (via feature flag)
4. Compare results and performance

**Success Criteria**:
- Zero errors on Cloudflare stack
- Query latency < 2s (p95)
- Results match Supabase responses

**Monitoring**:
```typescript
// Feature flag for gradual rollout
const USE_CLOUDFLARE = Math.random() < 0.1; // 10% traffic

if (USE_CLOUDFLARE) {
  return await getContextCloudflare(question, tags, env);
} else {
  return await getContextSupabase(question, tags, supabase);
}
```

### Phase 2: Gradual Migration (Week 11)

**Goal**: Increase traffic to 50%

**Actions**:
1. Increase feature flag to 50%
2. Monitor error rates and performance
3. Fix any issues discovered
4. Continue syncing data between systems

**Success Criteria**:
- Error rate < 1%
- No performance degradation
- User feedback positive

### Phase 3: Full Migration (Week 12)

**Goal**: Route 100% traffic to Cloudflare

**Actions**:
1. Increase feature flag to 100%
2. Keep Supabase as read-only backup
3. Monitor for 1 week
4. Disable Supabase writes

**Success Criteria**:
- Zero production incidents
- Performance targets met
- Data consistency verified

### Phase 4: Decommission (Week 13)

**Goal**: Archive Supabase and clean up

**Actions**:
1. Export final Supabase data backup
2. Cancel Supabase subscription
3. Remove Supabase client from codebase
4. Remove feature flags
5. Update documentation

---

## Rollback Procedure

### Immediate Rollback (< 5 minutes)

**Trigger**: Critical production issue

**Steps**:
1. Set feature flag to 0% (route all traffic to Supabase)
2. Verify traffic restored
3. Investigate issue

```typescript
// Emergency rollback flag
export const CLOUDFLARE_ENABLED = false;
```

### Quick Rollback (< 30 minutes)

**Trigger**: Persistent errors, performance issues

**Steps**:
1. Revert Worker deployment to previous version
2. Rollback D1 migrations if needed
3. Clear Vectorize index if corrupted
4. Restore from Supabase backup

```bash
# Rollback Workers
wrangler rollback --env production

# Rollback D1 migrations
wrangler d1 migrations list --env production
wrangler d1 execute --env production --command "DROP TABLE chunks"
# Re-run previous migrations
```

### Full Rollback (< 2 hours)

**Trigger**: Fundamental architecture issues

**Steps**:
1. Route all traffic back to Supabase
2. Archive Cloudflare data
3. Restore original Python ingestion scripts
4. Resume Supabase-only operation
5. Post-mortem analysis

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (unit, integration, e2e)
- [ ] Performance benchmarks met
- [ ] Staging deployment successful
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Rollback procedure tested

### Deployment

- [ ] Deploy to production during low-traffic window
- [ ] Monitor error rates in real-time
- [ ] Verify health checks passing
- [ ] Check metrics dashboards
- [ ] Test critical user flows

### Post-Deployment

- [ ] Monitor for 24 hours
- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Verify data consistency
- [ ] User acceptance testing
- [ ] Update status page

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main
    paths:
      - 'apps/service/**'
      - 'apps/document-processor/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: wrangler deploy --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Monitoring During Rollout

### Key Metrics to Watch

- Error rate (target: < 1%)
- P95 latency (target: < 2s)
- Throughput (requests/second)
- CPU time per request
- Subrequest count
- D1 query latency
- Vectorize query latency

### Alerts Configuration

```typescript
// Alert if error rate > 5%
if (errorRate > 0.05) {
  sendAlert('CRITICAL: Error rate exceeds 5%');
  // Consider automatic rollback
}

// Alert if latency degrades
if (p95Latency > 5000) {
  sendAlert('WARNING: P95 latency > 5s');
}
```

---

## Related Documents

- [High-Level Design](./cloudflare-migration-high-level.md)
- [Implementation Plan](../02-implementation-plan.md)
- [Monitoring & Observability](./monitoring.md)
- [Risk Assessment](./risk-assessment.md)
