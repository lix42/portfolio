import {
  SSEChunkEventSchema,
  SSEContextEventSchema,
  SSEDoneEventSchema,
  SSEErrorEventSchema,
  type SSEEvent,
  SSEInitEventSchema,
  SSEPreprocessedEventSchema,
  SSEStatusEventSchema,
} from "@portfolio/shared";

const eventSchemas = {
  init: SSEInitEventSchema,
  status: SSEStatusEventSchema,
  preprocessed: SSEPreprocessedEventSchema,
  context: SSEContextEventSchema,
  chunk: SSEChunkEventSchema,
  done: SSEDoneEventSchema,
  error: SSEErrorEventSchema,
};

function parseSSEBlock(block: string): SSEEvent | null {
  let event = "";
  let data = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data = line.slice("data:".length).trim();
    }
  }

  if (!event || !data) {
    console.warn("[sse] Skipping block with missing event or data:", block);
    return null;
  }
  if (!(event in eventSchemas)) {
    console.warn(`[sse] Unknown event type: "${event}"`);
    return null;
  }

  const schema = eventSchemas[event as keyof typeof eventSchemas];

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(data);
  } catch {
    console.warn(`[sse] Malformed JSON in event "${event}":`, data);
    return null;
  }

  const parsed = schema.safeParse(jsonData);
  if (!parsed.success) {
    console.warn(
      `[sse] Schema validation failed for "${event}":`,
      parsed.error.issues,
    );
    return null;
  }

  return { event, data: parsed.data } as SSEEvent;
}

export async function* streamSSEEvents(
  response: Response,
): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no readable body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE blocks are separated by double newlines
      const blocks = buffer.split("\n\n");
      // Last element is incomplete — keep it in the buffer
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        const event = parseSSEBlock(trimmed);
        if (event) yield event;
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const event = parseSSEBlock(buffer.trim());
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
