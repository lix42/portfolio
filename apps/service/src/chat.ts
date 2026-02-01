/**
 * Chat Service API
 *
 * This module provides a REST API endpoint for processing user chat messages.
 * It combines AI-powered tag generation, text embedding, and semantic search
 * to provide relevant responses from a knowledge base.
 */

import {
  type ChatErrorResponse,
  ChatErrorResponseSchema,
  ChatRequestSchema,
  type ChatSuccessResponse,
  ChatSuccessResponseSchema,
} from "@portfolio/shared";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import OpenAI from "openai";
import {
  answerQuestionWithChunks,
  extractAssistantAnswer,
} from "./answerQuestion";
import chatSSE from "./chatSSE";
import { getContext } from "./getContext";
import { preprocessQuestion } from "./preprocessQuestion";
import { embed } from "./utils/embed";

/**
 * Hono app instance configured for Cloudflare Workers
 * Uses CloudflareBindings for environment variable typing
 */
const app = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * POST / - Chat message processing endpoint
 *
 * This endpoint processes user chat messages through the following pipeline:
 * 1. Validates the incoming message using Zod schema
 * 2. Initializes OpenAI client
 * 3. Generates preprocess and embeddings for the message concurrently
 * 4. Validates the generated tags and embeddings
 * 5. Performs semantic search using D1, Vectorize, and R2
 * 6. Returns the processed results including the answer
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
app.post(
  "/",
  describeRoute({
    summary: "Chat with AI about portfolio",
    description:
      "Ask questions about portfolio, work experience, skills, and projects. Uses RAG (Retrieval-Augmented Generation) to provide accurate, context-aware answers.",
    tags: ["Chat"],
    responses: {
      200: {
        description: "Successfully generated answer",
        content: {
          "application/json": {
            schema: resolver(ChatSuccessResponseSchema),
          },
        },
      },
      400: {
        description: "Invalid or missing message",
        content: {
          "application/json": {
            schema: resolver(ChatErrorResponseSchema),
          },
        },
      },
      500: {
        description: "Internal server error during processing",
        content: {
          "application/json": {
            schema: resolver(ChatErrorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", ChatRequestSchema),
  async (c) => {
    // Extract and validate the message from the request body
    const { message } = c.req.valid("json");
    const result = await answerQuestion(message, c.env);

    if (result.hasError) {
      const response: ChatErrorResponse = {
        status: "error",
        error: result.error,
      };
      return c.json(response, result.code);
    }
    // Return successful response with the original message, generated tags, and search results
    // Provide empty array as fallback if no search results are found
    const response: ChatSuccessResponse = {
      status: "ok",
      answer: result.answer,
    };
    return c.json(response);
  },
);

export const answerQuestion = async (
  message: string,
  env: CloudflareBindings,
): Promise<
  | { hasError: false; answer: string }
  | { hasError: true; error: string; code: ContentfulStatusCode }
> => {
  // Initialize OpenAI client with API key from environment variables
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Process message concurrently: generate tags and create embeddings
  // This improves performance by running both operations in parallel
  const [preprocessResult, embedding] = await Promise.all([
    preprocessQuestion(message, openai), // Generate relevant preprocess for categorization
    embed(message, openai), // Create vector embedding for semantic search
  ]);

  // Validate that the generated preprocess are valid
  // If tags are invalid, return an error response
  if (!preprocessResult?.is_valid) {
    return { hasError: true, error: "Invalid question", code: 400 };
  }

  // Validate that the embedding was created successfully
  // If embedding fails, return an internal server error
  if (!embedding) {
    return { hasError: true, error: "Failed to create embedding", code: 500 };
  }

  // Use Cloudflare bindings for D1, Vectorize, and R2
  const { topChunks } = await getContext(
    embedding,
    preprocessResult.tags,
    env, // Pass env instead of supabaseClient
  );

  const answer = extractAssistantAnswer(
    await answerQuestionWithChunks(topChunks, message, openai),
  );

  return { hasError: false, answer };
};

// Mount SSE streaming endpoint
app.route("/sse", chatSSE);

export default app;
