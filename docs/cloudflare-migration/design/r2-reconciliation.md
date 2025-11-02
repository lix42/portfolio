# R2 Reconciliation Worker Design

**Component**: Self-Healing Reconciliation System
**Location**: `apps/r2-reconciliation/` or part of `apps/document-processor/`
**Schedule**: Daily cron job

---

## Overview

The R2 Reconciliation Worker is a scheduled Worker that discovers and processes documents that were missed by R2 event notifications. It provides a self-healing system that ensures no documents are left unprocessed.

### Why Needed

R2 event notifications are delivered on a "best-effort" basis. While typically reliable, events can be:
- Delayed during high load
- Missed in rare edge cases
- Lost during system maintenance

The reconciliation worker catches these edge cases.

---

## Architecture

```typescript
export default {
  // Scheduled cron job - runs daily at 2 AM UTC
  async scheduled(event: ScheduledEvent, env: Env) {
    await reconcileR2Documents(env);
  },

  // Manual trigger endpoint
  async fetch(request: Request, env: Env) {
    if (request.url.endsWith('/reconcile')) {
      await reconcileR2Documents(env);
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Reconciliation started'
      }));
    }
    return new Response('Not found', { status: 404 });
  }
};
```

---

## Reconciliation Logic

```typescript
async function reconcileR2Documents(env: Env) {
  const BATCH_SIZE = 100;
  let cursor: string | undefined;
  let totalChecked = 0;
  let totalQueued = 0;

  do {
    // List objects in R2 bucket
    const listed = await env.DOCUMENTS_BUCKET.list({
      limit: BATCH_SIZE,
      cursor,
      prefix: 'documents/'
    });

    for (const object of listed.objects) {
      totalChecked++;

      // Check if document exists in D1
      const existing = await env.DB.prepare(`
        SELECT id FROM documents WHERE r2_key = ?
      `).bind(object.key).first();

      if (!existing) {
        // Check Durable Object status
        const processorId = env.DOCUMENT_PROCESSOR.idFromName(object.key);
        const processor = env.DOCUMENT_PROCESSOR.get(processorId);
        const statusResponse = await processor.fetch(
          new Request('http://do/status')
        );
        const status = await statusResponse.json();

        if (status.status === 'not_started' || status.status === 'failed') {
          // Queue for processing
          await env.PROCESSING_QUEUE.send({ r2Key: object.key });
          totalQueued++;
        } else if (status.status === 'processing') {
          // Check if stuck (>24 hours)
          const startedAt = new Date(status.timing.startedAt);
          const hours = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);

          if (hours > 24) {
            await processor.fetch(
              new Request('http://do/retry', { method: 'POST' })
            );
          }
        }
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  console.log(`Reconciliation complete: checked ${totalChecked}, queued ${totalQueued}`);
}
```

---

## Configuration

```jsonc
// wrangler.toml
{
  "name": "r2-reconciliation",
  "triggers": {
    "crons": ["0 2 * * *"]  // Run daily at 2 AM UTC
  },
  "r2_buckets": [{
    "binding": "DOCUMENTS_BUCKET",
    "bucket_name": "portfolio-documents"
  }],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "portfolio-db"
  }],
  "durable_objects": {
    "bindings": [{
      "name": "DOCUMENT_PROCESSOR",
      "class_name": "DocumentProcessor",
      "script_name": "document-processor"
    }]
  },
  "queues": {
    "producers": [{
      "binding": "PROCESSING_QUEUE",
      "queue": "document-processing"
    }]
  }
}
```

---

## Benefits

- **Self-healing**: Automatically discovers unprocessed documents
- **Idempotent**: Safe to run multiple times
- **Monitoring**: Provides visibility into processing health
- **Resilient**: Handles both missed events and stuck jobs

---

## Related Documents

- [Document Processor](./document-processor.md)
- [High-Level Design](../01-high-level-design.md)
- [Monitoring & Observability](../operations/monitoring.md)
