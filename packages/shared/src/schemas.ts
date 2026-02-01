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
 * SSE Event Schemas for Chat Streaming
 *
 * These schemas define the structure of Server-Sent Events
 * emitted during the RAG pipeline execution.
 */

export const SSEStatusEventSchema = z.object({
  step: z.enum(["init", "preprocessing", "searching", "generating"]),
  message: z.string().min(1),
});

export const SSEInitEventSchema = z.object({
  requestId: z.string().uuid(),
});

export const SSEPreprocessedEventSchema = z.object({
  tags: z.array(z.string()),
  isValid: z.boolean(),
});

export const SSEContextEventSchema = z.object({
  chunksCount: z.number().int().nonnegative(),
  documentFound: z.boolean(),
});

export const SSEChunkEventSchema = z.object({
  text: z.string().min(1),
});

export const SSEDoneEventSchema = z.object({
  answer: z.string(),
});

export const SSEErrorEventSchema = z.object({
  error: z.string().min(1),
  code: z.number().int().min(400).max(599),
  requestId: z.string().uuid().optional(),
});

export const SSEEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("init"), data: SSEInitEventSchema }),
  z.object({ event: z.literal("status"), data: SSEStatusEventSchema }),
  z.object({
    event: z.literal("preprocessed"),
    data: SSEPreprocessedEventSchema,
  }),
  z.object({ event: z.literal("context"), data: SSEContextEventSchema }),
  z.object({ event: z.literal("chunk"), data: SSEChunkEventSchema }),
  z.object({ event: z.literal("done"), data: SSEDoneEventSchema }),
  z.object({ event: z.literal("error"), data: SSEErrorEventSchema }),
]);

export type SSEInitEvent = z.infer<typeof SSEInitEventSchema>;
export type SSEStatusEvent = z.infer<typeof SSEStatusEventSchema>;
export type SSEPreprocessedEvent = z.infer<typeof SSEPreprocessedEventSchema>;
export type SSEContextEvent = z.infer<typeof SSEContextEventSchema>;
export type SSEChunkEvent = z.infer<typeof SSEChunkEventSchema>;
export type SSEDoneEvent = z.infer<typeof SSEDoneEventSchema>;
export type SSEErrorEvent = z.infer<typeof SSEErrorEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
