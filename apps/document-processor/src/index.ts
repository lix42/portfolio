/**
 * Document Processor Worker
 *
 * Entry point for:
 * 1. Queue consumer - processes messages from PROCESSING_QUEUE
 * 2. HTTP endpoints - status checks and manual triggers
 */

import { DocumentProcessor } from "./document-processor";
import type { ProcessingMessage } from "./types";

export { DocumentProcessor };

const getRouteKey = (path: string, method: string): string => {
  return `${method.toUpperCase()} ${path}`;
};

type RouteHandler = (request: Request, env: Env) => Promise<Response>;

const getHealth: RouteHandler = async (_r: Request, env: Env) => {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "document-processor",
      version: "1.0.0",
      environment: env.ENVIRONMENT,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};

const getStub = (r2Key: string | null | undefined, env: Env) => {
  // Get Durable Object
  if (!r2Key) {
    const res = new Response(JSON.stringify({ error: "r2Key required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    return { stub: undefined, res };
  } else {
    const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
    const stub = env.DOCUMENT_PROCESSOR.get(id);
    return { res: undefined, stub };
  }
};

// Manual processing trigger: POST /process with JSON body: { "r2Key": "..." }
const postProcess: RouteHandler = async (request: Request, env: Env) => {
  const body = (await request.json()) as { r2Key: string };
  console.log(`postProcess: ${JSON.stringify(body)}`);
  const r2Key = body.r2Key;

  // Get Durable Object
  const { res, stub } = getStub(r2Key, env);
  if (!stub) {
    return res;
  }

  // Forward request
  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ r2Key }),
  });

  return response;
};

// Status check: GET /status?r2key=...
const getStatus: RouteHandler = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  const r2Key = url.searchParams.get("r2key");

  // Get Durable Object
  const { res, stub } = getStub(r2Key, env);
  if (!stub) {
    return res;
  }

  // Forward request
  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/status", {
    method: "GET",
  });

  return response;
};

// query data: GET /data?r2key=...
const getData: RouteHandler = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  const r2Key = url.searchParams.get("r2key");

  if (!r2Key) {
    return new Response(JSON.stringify({ error: "r2key required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Query document by r2_key
  const doc = await env.DB.prepare(
    "SELECT id, r2_key, project, tags, company_id, created_at FROM documents WHERE r2_key = ?",
  )
    .bind(r2Key)
    .first<{
      id: number;
      r2_key: string;
      project: string;
      tags: string;
      company_id: number;
      created_at: string;
    }>();

  if (!doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Query company
  const company = await env.DB.prepare(
    "SELECT id, name FROM companies WHERE id = ?",
  )
    .bind(doc.company_id)
    .first<{ id: number; name: string }>();

  // 3. Query chunks
  const chunksResult = await env.DB.prepare(
    "SELECT id, content, tags, vectorize_id, created_at FROM chunks WHERE document_id = ? ORDER BY id",
  )
    .bind(doc.id)
    .all<{
      id: number;
      content: string;
      tags: string;
      vectorize_id: string;
      created_at: string;
    }>();

  // 4. Query Vectorize for embeddings
  const vectorizeIds = chunksResult.results.map((c) => c.vectorize_id);
  const vectors =
    vectorizeIds.length > 0 ? await env.VECTORIZE.getByIds(vectorizeIds) : [];

  // 5. Combine and return
  const response = {
    document: {
      id: doc.id,
      r2Key: doc.r2_key,
      project: doc.project,
      tags: JSON.parse(doc.tags || "[]") as string[],
      company: company ? { id: company.id, name: company.name } : null,
      createdAt: doc.created_at,
    },
    chunks: chunksResult.results.map((chunk) => {
      const vector = vectors.find((v) => v.id === chunk.vectorize_id);
      return {
        id: chunk.id,
        content: chunk.content,
        tags: JSON.parse(chunk.tags || "[]") as string[],
        vectorizeId: chunk.vectorize_id,
        embedding: vector?.values || null,
      };
    }),
  };

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
};

// Resume processing: POST /resume?r2Key=...
const postResume: RouteHandler = async (request: Request, env: Env) => {
  const { r2Key } = (await request.json()) as { r2Key: string };

  const { res, stub } = getStub(r2Key, env);
  if (!stub) {
    return res;
  }

  // Forward request
  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/resume", {
    method: "POST",
  });

  return response;
};

// Reprocess document: POST /reprocess with JSON body: { "r2Key": "..." }
const postReprocess: RouteHandler = async (request: Request, env: Env) => {
  const body = (await request.json()) as { r2Key: string };
  const r2Key = body.r2Key;

  const { res, stub } = getStub(r2Key, env);
  if (!stub) {
    return res;
  }

  // Forward request
  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/reprocess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ r2Key }),
  });

  return response;
};

const getListR2Keys: RouteHandler = async (_r: Request, env: Env) => {
  const r2 = env.DOCUMENTS_BUCKET;
  console.log("Listing R2 keys...");
  const listed = await r2.list({ limit: 10 });
  const result = listed.objects.map(({ key, size }) => ({
    key,
    size,
  }));

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
};

// Delete Durable Object state: DELETE /delete with JSON body: { "r2Key": "..." }
const deleteDocument: RouteHandler = async (request: Request, env: Env) => {
  const { r2Key } = (await request.json()) as { r2Key: string };

  const { res, stub } = getStub(r2Key, env);
  if (!stub) {
    return res;
  }

  // Forward request
  // eslint-disable-next-line sonarjs/no-clear-text-protocols
  const response = await stub.fetch("http://internal/delete", {
    method: "DELETE",
  });

  return response;
};

const routeHandlers: Record<string, RouteHandler> = {
  [getRouteKey("/", "GET")]: getHealth,
  [getRouteKey("/health", "GET")]: getHealth,
  [getRouteKey("/process", "POST")]: postProcess,
  [getRouteKey("/status", "GET")]: getStatus,
  [getRouteKey("/data", "GET")]: getData,
  [getRouteKey("/resume", "POST")]: postResume,
  [getRouteKey("/reprocess", "POST")]: postReprocess,
  [getRouteKey("/delete", "DELETE")]: deleteDocument,
  [getRouteKey("/r2-keys", "GET")]: getListR2Keys,
};

/**
 * Queue consumer handler
 * Triggered automatically by Cloudflare Queues
 */
export default {
  async queue(
    batch: MessageBatch<ProcessingMessage>,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages from queue`);

    // Process each message
    for (const message of batch.messages) {
      try {
        const { r2Key } = message.body;

        if (!r2Key) {
          console.error("Message missing r2Key:", message);
          message.ack();
          continue;
        }

        console.log(`Processing document: ${r2Key}`);

        // Get Durable Object for this document (idempotent ID based on r2Key)
        const id = env.DOCUMENT_PROCESSOR.idFromName(r2Key);
        const stub = env.DOCUMENT_PROCESSOR.get(id);

        // Trigger processing
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        await stub.fetch("http://internal/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ r2Key }),
        });

        // Acknowledge message
        message.ack();
        console.log(`Message acknowledged for ${r2Key}`);
      } catch (error) {
        console.error("Error processing message:", error);
        // Don't ack - message will be retried
        message.retry();
      }
    }
  },

  /**
   * HTTP fetch handler for manual operations
   */
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const routeKey = getRouteKey(path, request.method);
    const handler = routeHandlers[routeKey];

    try {
      if (handler) {
        return await handler(request, env);
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
