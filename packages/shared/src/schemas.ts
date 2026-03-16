import { z } from "zod";

/**
 * Schema for document metadata JSON files (e.g., webforms.json)
 *
 * These files contain metadata about each markdown document:
 * - project: Name of the project
 * - document: Relative path to the markdown file
 * - company: Company name where the project was done
 */
export const documentMetadataSchema = z.object({
  project: z.string().min(1, "Project name is required"),
  document: z.string().min(1, "Document path is required"),
  company: z.string().min(1, "Company name is required"),
});

/**
 * Type inferred from schema
 */
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

/**
 * Validate document metadata with detailed error messages
 */
export function validateDocumentMetadata(data: unknown): {
  success: boolean;
  data?: DocumentMetadata;
  errors?: string[];
} {
  const result = documentMetadataSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(
    (err) => `${err.path.join(".")}: ${err.message}`,
  );

  return { success: false, errors };
}

/**
 * Health check response schema
 *
 * Used by:
 * - apps/service (producer)
 * - apps/ui (consumer)
 */
export const healthResponseSchema = z.object({
  ok: z
    .boolean()
    .describe(
      "Overall service health status - true if all bindings operational",
    ),
  version: z.string().describe("Deployed version metadata from Cloudflare"),
  services: z.object({
    d1: z.object({
      ok: z.boolean().describe("D1 database connectivity status"),
      message: z.string().optional().describe("Error message if unhealthy"),
    }),
    r2: z.object({
      ok: z.boolean().describe("R2 object storage connectivity status"),
      message: z.string().optional().describe("Error message if unhealthy"),
    }),
    vectorize: z.object({
      ok: z.boolean().describe("Vectorize index connectivity status"),
      message: z.string().optional().describe("Error message if unhealthy"),
    }),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Chat request schema - validates incoming chat messages
 */
export const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message too long (max 1000 characters)")
    .describe(
      "User question about portfolio, work experience, skills, or projects",
    ),
});

/**
 * Successful chat response schema
 */
export const ChatSuccessResponseSchema = z.object({
  status: z.literal("ok").describe("Indicates a successful response"),
  answer: z
    .string()
    .describe(
      "AI-generated answer based on portfolio documents and context retrieved via RAG",
    ),
});

/**
 * Chat error response schema
 */
export const ChatErrorResponseSchema = z.object({
  status: z.literal("error").describe("Indicates an error response"),
  error: z
    .string()
    .describe(
      "Error message - either validation error, processing failure, or server error",
    ),
});

export const ChatResponseSchema = z.discriminatedUnion("status", [
  ChatSuccessResponseSchema,
  ChatErrorResponseSchema,
]);

// Type exports for TypeScript consumers
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatSuccessResponse = z.infer<typeof ChatSuccessResponseSchema>;
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>;

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/**
 * Type guard to check if response is a successful chat response
 */
export function isSuccessChat(
  response: ChatResponse,
): response is ChatSuccessResponse {
  return "answer" in response;
}

/**
 * Type guard to check if response is an error chat response
 */
export function isErrorChat(
  response: ChatSuccessResponse | ChatErrorResponse,
): response is ChatErrorResponse {
  return "error" in response;
}

/**
 * R2 Sync CLI options schema
 *
 * Used by apps/r2-sync to validate command-line options
 */
export const syncOptionsSchema = z.object({
  documentsPath: z.string().min(1),
  dryRun: z.boolean().default(false),
  allowDelete: z.boolean().default(false),
  ci: z.boolean().default(false),
  json: z.boolean().default(false),
  failFast: z.boolean().default(false),
  filePattern: z.string().optional(),
  maxRetries: z.number().int().min(1).max(10).default(3),
});

export type SyncOptions = z.infer<typeof syncOptionsSchema>;

/**
 * Stream Event Schemas for Chat Streaming
 *
 * These schemas define the structure of streaming events
 * emitted during the RAG pipeline execution.
 * Used by both SSE and JSONL transports.
 */

export const StreamStatusEventSchema = z.object({
  step: z.enum(["preprocessing", "searching", "generating"]),
  message: z.string().min(1),
});

export const StreamInitEventSchema = z.object({
  requestId: z.string().uuid(),
});

export const StreamPreprocessedEventSchema = z.object({
  tags: z.array(z.string()),
  isValid: z.boolean(),
});

export const StreamContextEventSchema = z.object({
  chunksCount: z.number().int().nonnegative(),
  documentFound: z.boolean(),
});

export const StreamChunkEventSchema = z.object({
  text: z.string().min(1),
});

export const StreamDoneEventSchema = z.object({
  answer: z.string(),
});

export const StreamErrorEventSchema = z.object({
  error: z.string().min(1),
  code: z.number().int().min(400).max(599),
  requestId: z.string().uuid().optional(),
});

export const StreamEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("init"), data: StreamInitEventSchema }),
  z.object({ event: z.literal("status"), data: StreamStatusEventSchema }),
  z.object({
    event: z.literal("preprocessed"),
    data: StreamPreprocessedEventSchema,
  }),
  z.object({ event: z.literal("context"), data: StreamContextEventSchema }),
  z.object({ event: z.literal("chunk"), data: StreamChunkEventSchema }),
  z.object({ event: z.literal("done"), data: StreamDoneEventSchema }),
  z.object({ event: z.literal("error"), data: StreamErrorEventSchema }),
]);

export type StreamInitEvent = z.infer<typeof StreamInitEventSchema>;
export type StreamStatusEvent = z.infer<typeof StreamStatusEventSchema>;
export type StreamPreprocessedEvent = z.infer<
  typeof StreamPreprocessedEventSchema
>;
export type StreamContextEvent = z.infer<typeof StreamContextEventSchema>;
export type StreamChunkEvent = z.infer<typeof StreamChunkEventSchema>;
export type StreamDoneEvent = z.infer<typeof StreamDoneEventSchema>;
export type StreamErrorEvent = z.infer<typeof StreamErrorEventSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
