import type { StreamEvent } from "@portfolio/shared";

import { validateEvent } from "./streamEvents";

function parseJSONLine(line: string): StreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    console.warn("[jsonl] Malformed JSON line:", line);
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("event" in parsed) ||
    !("data" in parsed)
  ) {
    console.warn("[jsonl] Line missing event or data:", line);
    return null;
  }

  const { event, data } = parsed as { event: string; data: unknown };
  return validateEvent(event, data, "jsonl");
}

export async function* streamJSONLEvents(
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

      const lines = buffer.split("\n");
      // Last element may be incomplete — keep it in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = parseJSONLine(trimmed);
        if (event) yield event;
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const event = parseJSONLine(buffer.trim());
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
