import {
  StreamChunkEventSchema,
  StreamContextEventSchema,
  StreamDoneEventSchema,
  StreamErrorEventSchema,
  type StreamEvent,
  StreamInitEventSchema,
  StreamPreprocessedEventSchema,
  StreamStatusEventSchema,
} from "@portfolio/shared";

export const eventSchemas = {
  init: StreamInitEventSchema,
  status: StreamStatusEventSchema,
  preprocessed: StreamPreprocessedEventSchema,
  context: StreamContextEventSchema,
  chunk: StreamChunkEventSchema,
  done: StreamDoneEventSchema,
  error: StreamErrorEventSchema,
};

type EventKey = keyof typeof eventSchemas;

function isEventKey(text: string): text is EventKey {
  return Object.hasOwn(eventSchemas, text);
}

/**
 * Validates event data against the schema for the given event type.
 * Returns a typed StreamEvent or null if validation fails.
 */
export function validateEvent(
  event: string,
  data: unknown,
  tag: string,
): StreamEvent | null {
  if (!isEventKey(event)) {
    console.warn(`[${tag}] Unknown event type: "${event}"`);
    return null;
  }

  const schema = eventSchemas[event];
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[${tag}] Schema validation failed for "${event}":`,
      result.error.issues,
    );
    return null;
  }

  return { event, data: result.data } as StreamEvent;
}
