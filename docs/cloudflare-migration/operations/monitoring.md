# Monitoring & Observability

**Version**: 1.0
**Last Updated**: November 1, 2025

---

## Overview

Comprehensive monitoring is critical for operating a distributed document processing pipeline with Durable Objects, D1, Vectorize, and R2. This document outlines the monitoring strategy for all components.

---

## 1. Durable Objects Monitoring

### State Inspection API

Add monitoring endpoints to DocumentProcessor:

```typescript
export class DocumentProcessor extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/metrics':
        return this.getMetrics();
      case '/health':
        return this.getHealth();
      // ... existing routes
    }
  }

  private async getMetrics(): Promise<Response> {
    const state = await this.state.storage.get([
      'status', 'totalChunks', 'processedChunks',
      'startedAt', 'completedAt', 'errors'
    ]);

    const metrics = {
      status: state.status,
      progress: state.totalChunks ?
        (state.processedChunks / state.totalChunks * 100).toFixed(2) + '%' : '0%',
      duration: state.startedAt ?
        Date.now() - new Date(state.startedAt).getTime() : 0,
      errorCount: state.errors?.length || 0,
      chunksPerSecond: state.processedChunks && state.startedAt ?
        state.processedChunks / ((Date.now() - new Date(state.startedAt).getTime()) / 1000) : 0
    };

    return new Response(JSON.stringify(metrics));
  }
}
```

### Aggregated Metrics Dashboard

```typescript
async function getSystemMetrics(env: Env): Promise<SystemMetrics> {
  // Query D1 for processing statistics
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_documents,
      COUNT(CASE WHEN created_at > datetime('now', '-1 hour') THEN 1 END) as docs_last_hour,
      COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as docs_last_day
    FROM documents
  `).first();

  return {
    documents: stats,
    timestamp: new Date().toISOString()
  };
}
```

---

## 2. Processing Pipeline Metrics

### Key Performance Indicators (KPIs)

- **Processing Throughput**: Documents processed per hour
- **Processing Latency**: Time from R2 upload to completion
- **Error Rate**: Failed processing jobs / total jobs
- **Chunk Processing Speed**: Chunks per second
- **OpenAI API Latency**: Average time for embeddings/tags
- **Queue Depth**: Number of pending documents

### Custom Metrics Collection

```typescript
class MetricsLogger {
  async logProcessingComplete(jobId: string, metrics: ProcessingMetrics) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'processing_complete',
      jobId,
      documentSize: metrics.documentSize,
      chunkCount: metrics.chunkCount,
      processingTimeMs: metrics.duration,
      embeddingTimeMs: metrics.embeddingTime,
      tagGenerationTimeMs: metrics.tagTime,
      storageTimeMs: metrics.storageTime,
      errors: metrics.errors
    }));
  }

  async logError(jobId: string, step: string, error: Error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'processing_error',
      jobId,
      step,
      error: error.message,
      stack: error.stack
    }));
  }
}
```

---

## 3. Alerting Rules

### Critical Alerts

```typescript
const alertRules = [
  {
    name: 'high_error_rate',
    condition: async () => {
      const stats = await getErrorRate();
      return stats.rate > 0.05; // > 5% error rate
    },
    message: 'Document processing error rate exceeds 5%',
    severity: 'critical'
  },
  {
    name: 'stuck_processing',
    condition: async () => {
      const stuck = await getStuckJobs();
      return stuck.count > 10;
    },
    message: 'More than 10 documents stuck in processing',
    severity: 'warning'
  },
  {
    name: 'reconciliation_issues',
    condition: async () => {
      const stats = await getLastReconciliation();
      return stats.queuedCount > 50;
    },
    message: 'Reconciliation found >50 unprocessed documents',
    severity: 'warning'
  }
];
```

---

## 4. Health Checks

### Service Health Endpoints

```typescript
export async function handleHealthCheck(env: Env): Promise<Response> {
  const checks = {
    d1: await checkD1Health(env.DB),
    r2: await checkR2Health(env.DOCUMENTS_BUCKET),
    vectorize: await checkVectorizeHealth(env.VECTORIZE),
    queue: await checkQueueHealth(env.PROCESSING_QUEUE)
  };

  const healthy = Object.values(checks).every(c => c.healthy);

  return new Response(JSON.stringify({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }), {
    status: healthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function checkD1Health(db: D1Database): Promise<HealthCheck> {
  try {
    await db.prepare('SELECT 1').first();
    return { healthy: true, latencyMs: 0 };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

---

## 5. Performance Tracing

```typescript
class PerformanceTracer {
  private spans: Map<string, number> = new Map();

  startSpan(name: string): void {
    this.spans.set(name, Date.now());
  }

  endSpan(name: string): number {
    const start = this.spans.get(name);
    if (!start) return 0;

    const duration = Date.now() - start;
    this.spans.delete(name);

    console.log(JSON.stringify({
      type: 'performance_span',
      name,
      durationMs: duration,
      timestamp: new Date().toISOString()
    }));

    return duration;
  }
}

// Usage
const tracer = new PerformanceTracer();

tracer.startSpan('download_and_chunk');
await this.downloadAndChunk();
tracer.endSpan('download_and_chunk');
```

---

## 6. Cloudflare Analytics

### Workers Analytics

- Enable Workers Analytics in Cloudflare dashboard
- Track request count, duration, CPU time
- Monitor subrequest count per invocation
- Set up custom dashboards for DO metrics

### Logpush Configuration

```json
{
  "dataset": "workers_trace_events",
  "destination": "r2://logs-bucket/workers/",
  "filter": {
    "where": {
      "key": "ScriptName",
      "operator": "eq",
      "value": "document-processor"
    }
  },
  "enabled": true
}
```

---

## 7. Debugging Tools

### Durable Object State Inspector

```typescript
// Debug endpoint to inspect DO state (development only)
async function inspectDurableObject(r2Key: string, env: Env): Promise<any> {
  const processorId = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
  const processor = env.DOCUMENT_PROCESSOR.get(processorId);

  const response = await processor.fetch(
    new Request('http://do/debug/state')
  );

  return response.json();
}

// In DocumentProcessor class
case '/debug/state':
  if (this.env.ENVIRONMENT !== 'development') {
    return new Response('Forbidden', { status: 403 });
  }

  const allState = {};
  await this.state.storage.list().then(map => {
    map.forEach((value, key) => {
      allState[key] = value;
    });
  });

  return new Response(JSON.stringify(allState, null, 2));
```

---

## 8. Cost Monitoring

```typescript
interface CostMetrics {
  openaiTokens: number;
  openaiCost: number;
  r2Operations: number;
  d1Reads: number;
  d1Writes: number;
  vectorizeQueries: number;
  workerInvocations: number;
  durableObjectRequests: number;
}

async function calculateDailyCosts(env: Env): Promise<CostMetrics> {
  const metrics = await env.DB.prepare(`
    SELECT
      SUM(openai_tokens) as tokens,
      COUNT(*) as documents
    FROM processing_metrics
    WHERE created_at > datetime('now', '-24 hours')
  `).first();

  return {
    openaiTokens: metrics.tokens,
    openaiCost: metrics.tokens * 0.00002, // $0.02 per 1M tokens
    // ... calculate other costs
  };
}
```

---

## 9. SLA Monitoring

```typescript
interface SLAMetrics {
  availability: number;  // Target: 99.9%
  p95Latency: number;   // Target: < 5 seconds
  errorRate: number;    // Target: < 1%
}

async function checkSLA(env: Env): Promise<SLAReport> {
  const metrics = await calculateSLAMetrics(env);

  return {
    period: 'last_30_days',
    metrics,
    violations: [
      metrics.availability < 99.9 ? 'Availability below target' : null,
      metrics.p95Latency > 5000 ? 'P95 latency exceeds 5s' : null,
      metrics.errorRate > 0.01 ? 'Error rate exceeds 1%' : null
    ].filter(Boolean)
  };
}
```

---

## Benefits

- **Real-time visibility** into processing pipeline health
- **Proactive alerting** for issues before they impact users
- **Performance optimization** through detailed metrics
- **Cost tracking** for budget management
- **Debugging capabilities** for rapid issue resolution

---

## Related Documents

- [High-Level Design](../01-high-level-design.md)
- [Document Processor](../design/document-processor.md)
- [Deployment Strategy](./deployment.md)
- [Risk Assessment](./risk-assessment.md)
