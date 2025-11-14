import { z } from 'zod';

/**
 * Chat request schema - validates incoming chat messages
 */
export const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message too long (max 1000 characters)')
    .describe(
      'User question about portfolio, work experience, skills, or projects'
    ),
});

/**
 * Successful chat response schema
 */
export const ChatSuccessResponseSchema = z.object({
  answer: z
    .string()
    .describe(
      'AI-generated answer based on portfolio documents and context retrieved via RAG'
    ),
});

/**
 * Chat error response schema
 */
export const ChatErrorResponseSchema = z.object({
  error: z
    .string()
    .describe(
      'Error message - either validation error, processing failure, or server error'
    ),
});

// Type exports for TypeScript consumers
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatSuccessResponse = z.infer<typeof ChatSuccessResponseSchema>;
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>;
