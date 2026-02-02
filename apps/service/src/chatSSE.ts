/**
 * Chat SSE Endpoint
 *
 * Provides Server-Sent Events streaming for the RAG chat pipeline.
 * Emits real-time progress updates during question processing.
 */

import {
  ChatRequestSchema,
  type SSEChunkEvent,
  type SSEContextEvent,
  type SSEDoneEvent,
  type SSEErrorEvent,
  type SSEInitEvent,
  type SSEPreprocessedEvent,
  type SSEStatusEvent,
} from "@portfolio/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { validator as zValidator } from "hono-openapi";
import OpenAI from "openai";

import { answerQuestionStreaming } from "./answerQuestion";
import { getContext } from "./getContext";
import { preprocessQuestion } from "./preprocessQuestion";
import { embed } from "./utils/embed";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post("/", zValidator("json", ChatRequestSchema), async (c) => {
  const { message } = c.req.valid("json");

  return streamSSE(c, async (stream) => {
    const abortController = new AbortController();
    const requestId = crypto.randomUUID();

    stream.onAbort(() => {
      abortController.abort();
    });

    try {
      const openai = new OpenAI({ apiKey: c.env.OPENAI_API_KEY });

      // Emit init event with requestId for correlation
      await stream.writeSSE({
        event: "init",
        data: JSON.stringify({
          requestId,
        } satisfies SSEInitEvent),
      });

      // Step 1: Preprocessing and embedding
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          step: "preprocessing",
          message: "Analyzing question...",
        } satisfies SSEStatusEvent),
      });

      const [preprocessResult, embedding] = await Promise.all([
        preprocessQuestion(message, openai),
        embed(message, openai),
      ]);

      if (abortController.signal.aborted) return;

      // Emit preprocessed result
      await stream.writeSSE({
        event: "preprocessed",
        data: JSON.stringify({
          tags: preprocessResult?.tags ?? [],
          isValid: preprocessResult?.is_valid ?? false,
        } satisfies SSEPreprocessedEvent),
      });

      if (!preprocessResult?.is_valid) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: "Invalid question",
            code: 400,
            requestId,
          } satisfies SSEErrorEvent),
        });
        return;
      }

      if (!embedding) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: "Failed to create embedding",
            code: 500,
            requestId,
          } satisfies SSEErrorEvent),
        });
        return;
      }

      if (abortController.signal.aborted) return;

      // Step 2: Searching for context
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          step: "searching",
          message: "Searching documents...",
        } satisfies SSEStatusEvent),
      });

      const { topChunks } = await getContext(
        embedding,
        preprocessResult.tags,
        c.env,
      );

      if (abortController.signal.aborted) return;

      await stream.writeSSE({
        event: "context",
        data: JSON.stringify({
          chunksCount: topChunks?.length ?? 0,
          documentFound: topChunks !== null,
        } satisfies SSEContextEvent),
      });

      if (!topChunks) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: "No relevant documents found",
            code: 404,
            requestId,
          } satisfies SSEErrorEvent),
        });
        return;
      }

      // Step 3: Generating answer
      await stream.writeSSE({
        event: "status",
        data: JSON.stringify({
          step: "generating",
          message: "Generating answer...",
        } satisfies SSEStatusEvent),
      });

      let fullAnswer = "";
      for await (const chunk of answerQuestionStreaming(
        topChunks,
        message,
        openai,
        abortController.signal,
      )) {
        if (abortController.signal.aborted) return;
        fullAnswer += chunk;
        await stream.writeSSE({
          event: "chunk",
          data: JSON.stringify({ text: chunk } satisfies SSEChunkEvent),
        });
      }

      // Final done event
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ answer: fullAnswer } satisfies SSEDoneEvent),
      });
    } catch (err) {
      console.error("SSE stream error:", err);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          error: err instanceof Error ? err.message : "Internal server error",
          code: 500,
          requestId,
        } satisfies SSEErrorEvent),
      });
    }
  });
});

export default app;
