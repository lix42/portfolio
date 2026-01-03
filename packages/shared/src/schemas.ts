import { z } from 'zod';

/**
 * Schema for document metadata JSON files (e.g., webforms.json)
 *
 * These files contain metadata about each markdown document:
 * - project: Name of the project
 * - document: Relative path to the markdown file
 * - company: Company name where the project was done
 */
export const documentMetadataSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  document: z.string().min(1, 'Document path is required'),
  company: z.string().min(1, 'Company name is required'),
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
    (err) => `${err.path.join('.')}: ${err.message}`
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
      'Overall service health status - true if all bindings operational'
    ),
  version: z.string().describe('Deployed version metadata from Cloudflare'),
  services: z.object({
    d1: z.object({
      ok: z.boolean().describe('D1 database connectivity status'),
      message: z.string().optional().describe('Error message if unhealthy'),
    }),
    r2: z.object({
      ok: z.boolean().describe('R2 object storage connectivity status'),
      message: z.string().optional().describe('Error message if unhealthy'),
    }),
    vectorize: z.object({
      ok: z.boolean().describe('Vectorize index connectivity status'),
      message: z.string().optional().describe('Error message if unhealthy'),
    }),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Chat request schema
 */
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Chat response schema
 */
export const chatResponseSchema = z.object({
  answer: z.string(),
  sources: z
    .array(
      z.object({
        document: z.string(),
        chunk: z.string(),
        similarity: z.number(),
      })
    )
    .optional(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

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
