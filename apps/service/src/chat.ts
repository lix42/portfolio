/**
 * Chat Service API
 *
 * This module provides a REST API endpoint for processing user chat messages.
 * It combines AI-powered tag generation, text embedding, and semantic search
 * to provide relevant responses from a knowledge base.
 */

import { zValidator } from '@hono/zod-validator';
import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  answerQuestionWithChunks,
  extractAssistantAnswer,
} from './answerQuestion';
import { getContext } from './getContext';
import { preprocessQuestion } from './preprocessQuestion';
import { embed } from './utils/embed';

/**
 * Hono app instance configured for Cloudflare Workers
 * Uses CloudflareBindings for environment variable typing
 */
const app = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * Zod schema for validating incoming chat requests
 * Ensures the request body contains a valid message string
 */
const schema = z.object({
  message: z.string(),
});

/**
 * POST / - Chat message processing endpoint
 *
 * This endpoint processes user chat messages through the following pipeline:
 * 1. Validates the incoming message using Zod schema
 * 2. Initializes OpenAI and Supabase clients
 * 3. Generates preprocess and embeddings for the message concurrently
 * 4. Validates the generated tags and embeddings
 * 5. Performs semantic search against the knowledge base
 * 6. Returns the processed results including tags and search matches
 *
 * @route POST /
 * @body { message: string } - The user's chat message
 * @returns JSON response with message, preprocess, and search results
 *
 * @example
 * ```bash
 * curl -X POST / \
 *   -H "Content-Type: application/json" \
 *   -d '{"message": "How do I implement authentication?"}'
 * ```
 */
app.post('/', zValidator('json', schema), async (c) => {
  // Extract and validate the message from the request body
  const { message } = c.req.valid('json');
  const result = await answerQuestion(message, c.env);

  if (result.hasError) {
    return c.json({ error: result.error }, result.code);
  }
  // Return successful response with the original message, generated tags, and search results
  // Provide empty array as fallback if no search results are found
  return c.json({ answer: result.answer });
});

export type ChatResponse = { error: string } | { answer: string };

export const answerQuestion = async (
  message: string,
  env: CloudflareBindings
): Promise<
  | { hasError: false; answer: string }
  | { hasError: true; error: string; code: ContentfulStatusCode }
> => {
  // Initialize OpenAI client with API key from environment variables
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Initialize Supabase client with URL and key from environment variables
  // Configure fetch globally to ensure compatibility with Cloudflare Workers
  const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    global: {
      fetch: (...args) => fetch(...args),
    },
  });

  // Process message concurrently: generate tags and create embeddings
  // This improves performance by running both operations in parallel
  const [preprocessResult, embedding] = await Promise.all([
    preprocessQuestion(message, openai), // Generate relevant preprocess for categorization
    embed(message, openai), // Create vector embedding for semantic search
  ]);

  // Validate that the generated preprocess are valid
  // If tags are invalid, return an error response
  if (!preprocessResult?.is_valid) {
    return { hasError: true, error: 'Invalid question', code: 400 };
  }

  // Validate that the embedding was created successfully
  // If embedding fails, return an internal server error
  if (!embedding) {
    return { hasError: true, error: 'Failed to create embedding', code: 500 };
  }

  const { topChunks } = await getContext(
    embedding,
    preprocessResult.tags,
    supabaseClient
  );

  const answer = extractAssistantAnswer(
    await answerQuestionWithChunks(topChunks, message, openai)
  );

  return { hasError: false, answer };
};

export default app;
