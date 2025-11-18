/**
 * Document Processor Worker
 *
 * Entry point for:
 * 1. Queue consumer - processes messages from PROCESSING_QUEUE
 * 2. HTTP endpoints - status checks and manual triggers
 */

import { DocumentProcessor } from './document-processor';
import type { ProcessingMessage } from './types';

export { DocumentProcessor };

/**
 * Queue consumer handler
 * Triggered automatically by Cloudflare Queues
 */
export default {
  async queue(
    batch: MessageBatch<ProcessingMessage>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages from queue`);

    // Process each message
    for (const message of batch.messages) {
      try {
        const { r2Key } = message.body;

        if (!r2Key) {
          console.error('Message missing r2Key:', message);
          message.ack();
          continue;
        }

        console.log(`Processing document: ${r2Key}`);

        // Get Durable Object for this document (idempotent ID based on r2Key)
        const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const stub = env.DOCUMENT_PROCESSOR.get(id);

        // Trigger processing
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        await stub.fetch('http://internal/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key }),
        });

        // Acknowledge message
        message.ack();
        console.log(`Message acknowledged for ${r2Key}`);
      } catch (error) {
        console.error('Error processing message:', error);
        // Don't ack - message will be retried
        message.retry();
      }
    }
  },

  /**
   * HTTP fetch handler for manual operations
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/' || path === '/health') {
        return new Response(
          JSON.stringify({
            ok: true,
            service: 'document-processor',
            version: '1.0.0',
            environment: env.ENVIRONMENT,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Manual processing trigger: POST /process with JSON body: { "r2Key": "..." }
      if (path === '/process' && request.method === 'POST') {
        const { r2Key } = (await request.json()) as { r2Key: string };

        if (!r2Key) {
          return new Response(JSON.stringify({ error: 'r2Key required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Get Durable Object
        const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const stub = env.DOCUMENT_PROCESSOR.get(id);

        // Forward request
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        const response = await stub.fetch('http://internal/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key }),
        });

        return response;
      }

      // Status check: GET /status?r2Key=...
      if (path === '/status' && request.method === 'GET') {
        const r2Key = url.searchParams.get('r2Key');

        if (!r2Key) {
          return new Response(JSON.stringify({ error: 'r2Key required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Get Durable Object
        const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const stub = env.DOCUMENT_PROCESSOR.get(id);

        // Forward request
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        const response = await stub.fetch('http://internal/status', {
          method: 'GET',
        });

        return response;
      }

      // Resume processing: POST /resume?r2Key=...
      if (path === '/resume' && request.method === 'POST') {
        const { r2Key } = (await request.json()) as { r2Key: string };

        if (!r2Key) {
          return new Response(JSON.stringify({ error: 'r2Key required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Get Durable Object
        const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const stub = env.DOCUMENT_PROCESSOR.get(id);

        // Forward request
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        const response = await stub.fetch('http://internal/resume', {
          method: 'POST',
        });

        return response;
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
