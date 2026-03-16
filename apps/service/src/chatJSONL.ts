/**
 * Chat JSONL Endpoint
 *
 * Thin wrapper around the shared chat pipeline that streams
 * events using newline-delimited JSON format.
 */

import { ChatRequestSchema } from "@portfolio/shared";
import { Hono } from "hono";
import { streamText } from "hono/streaming";
import { describeRoute, validator as zValidator } from "hono-openapi";

import { runChatPipeline } from "./chatPipeline";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post(
  "/",
  describeRoute({
    summary: "Chat with AI via JSONL",
    description:
      "Streams real-time RAG pipeline progress events using newline-delimited JSON. Each line is a JSON object with event and data fields.",
    tags: ["Chat"],
    responses: {
      200: {
        description: "JSONL stream of chat events",
        content: {
          "application/x-ndjson": {
            schema: {
              type: "string",
              description:
                "Newline-delimited JSON stream emitting init, status, preprocessed, context, chunk, done, and error events",
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

    c.header("Content-Type", "application/x-ndjson");
    return streamText(c, async (stream) => {
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
            await stream.write(`${JSON.stringify(event)}\n`);
          },
        });
      } catch (err) {
        console.error("JSONL stream error:", err);
        try {
          await stream.write(
            `${JSON.stringify({ event: "error", data: { error: err instanceof Error ? err.message : "Internal server error", code: 500, requestId } })}\n`,
          );
        } catch (writeErr) {
          console.error("JSONL: failed to write error event:", writeErr);
        }
      }
    });
  },
);

export default app;
