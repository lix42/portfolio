import { z } from 'zod';

/**
 * Standard error response schema used across all endpoints
 */
export const ErrorResponseSchema = z.object({
  error: z.string().describe('Error message describing what went wrong'),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
