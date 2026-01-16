/**
 * Tag Generation Module
 *
 * This module provides functionality to automatically generate relevant tags for user questions
 * using OpenAI's GPT-4 model. It helps categorize and organize user queries for better
 * search and retrieval in the knowledge base system.
 */

import {
  DEFINE_TAGS_PROMPT,
  PREPROCESS_QUESTION_PROMPT,
  TAG_GENERATION_MODEL,
} from "@portfolio/shared";
import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { generateUserPromptProcessQuestion } from "./utils/prompts";

/**
 * Zod schema defining the structure of the tag generation result
 *
 * @property is_valid - Boolean indicating if the question is valid for preprocessing
 * @property tags - Array of strings representing the generated tags
 */
const PreprocessQuestionResult = z.object({
  is_valid: z.boolean(),
  tags: z.array(z.string()), // tags to be used for search
  explanation: z.string().nullable().optional(),
});

/**
 * TypeScript type derived from the PreprocessQuestionResult schema
 * Used for type safety throughout the application
 */
export type PreprocessQuestionResultType = z.infer<
  typeof PreprocessQuestionResult
>;

/**
 * Default result object returned when tag generation fails or is invalid
 * Provides a safe fallback to prevent undefined errors
 */
const nullResult: PreprocessQuestionResultType = {
  is_valid: false,
  tags: [],
};

/**
 * Generates relevant tags for a given text input using OpenAI's GPT-4 model
 *
 * This function uses a structured prompt system with three roles:
 * - system: Provides overall context and instructions
 * - developer: Gives specific technical guidance for tag generation
 * - user: Contains the actual text to be tagged
 *
 * The function leverages OpenAI's structured output parsing to ensure
 * consistent and valid tag results.
 *
 * @param text - The input text/question to generate tags for
 * @param openai - Configured OpenAI client instance
 * @returns Promise resolving to PreprocessQuestionResultType containing validation status and tags
 *
 * @example
 * ```typescript
 * const result = await preprocessQuestion("How do I implement authentication?", openaiClient);
 * if (result.is_valid) {
 *   console.log("Generated tags:", result.tags);
 * }
 * ```
 */
export const preprocessQuestion = async (
  text: string,
  openai: OpenAI,
): Promise<PreprocessQuestionResultType> => {
  // Generate the user prompt by formatting the input text
  const userPrompt = generateUserPromptProcessQuestion(text);

  // Make API call to OpenAI with structured prompts and output parsing
  const response = await openai.responses.parse({
    model: TAG_GENERATION_MODEL, // Use GPT-4 Omni for optimal tag generation quality
    input: [
      {
        role: "system",
        content: DEFINE_TAGS_PROMPT, // Provides overall context and tag generation rules
      },
      {
        role: "developer",
        content: PREPROCESS_QUESTION_PROMPT, // Technical guidance for consistent tagging
      },
      {
        role: "user",
        content: userPrompt, // The actual question/text to be tagged
      },
    ],
    // Use Zod schema validation to ensure structured output parsing
    text: { format: zodTextFormat(PreprocessQuestionResult, "tagsResult") },
  });

  // Return parsed result or fallback to null result if parsing fails
  return response.output_parsed ?? nullResult;
};
