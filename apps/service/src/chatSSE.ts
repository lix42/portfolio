/**
 * Chat SSE Endpoint
 *
 * Thin wrapper around the shared chat pipeline that streams
 * events using Server-Sent Events format.
 */

import { ChatRequestSchema } from "@portfolio/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { describeRoute, validator as zValidator } from "hono-openapi";

import { runChatPipeline } from "./chatPipeline";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post(
  "/",
  describeRoute({
    summary: "Chat with AI via SSE",
    description:
      "Streams real-time RAG pipeline progress events using Server-Sent Events. Emits init, status, preprocessed, context, chunk, done, and error events.",
    tags: ["Chat"],
    responses: {
      200: {
        description: "SSE stream of chat events",
        content: {
          "text/event-stream": {
            schema: {
              type: "string",
              description:
                "Server-Sent Events stream emitting init, status, preprocessed, context, chunk, done, and error events",
            },
          },
        },
      },
      400: { description: "Invalid question" },
      404: { description: "No relevant documents found" },
      500: { description: "Internal server error" },
    },
  }),
  zValidator("json", ChatRequestSchema),
  async (c) => {
    const { message } = c.req.valid("json");

    return streamSSE(c, async (stream) => {
      const abortController = new AbortController();
      stream.onAbort(() => abortController.abort());
      const requestId = crypto.randomUUID();

      try {
        await runChatPipeline({
          message,
          env: c.env,
          signal: abortController.signal,
          requestId,
          onEvent: async (event) => {
            await stream.writeSSE({
              event: event.event,
              data: JSON.stringify(event.data),
            });
          },
        });
      } catch (err) {
        console.error("SSE stream error:", err);
        try {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              error:
                err instanceof Error ? err.message : "Internal server error",
              code: 500,
              requestId,
            }),
          });
        } catch (writeErr) {
          console.error("SSE: failed to write error event:", writeErr);
        }
      }
    });
  },
);

export default app;
