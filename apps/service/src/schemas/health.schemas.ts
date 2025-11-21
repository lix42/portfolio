import { z } from 'zod';

/**
 * Health check endpoint response schema
 */
export const HealthResponseSchema = z.object({
  ok: z.boolean().describe('Service health status - true if operational'),
  version: z.string().describe('Deployed version metadata from Cloudflare'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
