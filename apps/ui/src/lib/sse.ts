import type { StreamEvent } from "@portfolio/shared";

import { validateEvent } from "./streamEvents";

function parseSSEBlock(block: string): StreamEvent | null {
  let event = "";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      // Per SSE spec, strip only a single leading space after the colon
      dataLines.push(line.substring("data:".length).replace(/^ /, ""));
    }
  }

  const dataStr = dataLines.join("\n");

  if (!event || !dataStr) {
    console.warn("[sse] Skipping block with missing event or data:", block);
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    console.warn(`[sse] Malformed JSON in event "${event}":`, dataStr);
    return null;
  }

  return validateEvent(event, data, "sse");
}

export async function* streamSSEEvents(
  response: Response,
): AsyncGenerator<StreamEvent> {
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
