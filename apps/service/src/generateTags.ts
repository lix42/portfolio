/**
 * Tag Generation Module
 *
 * This module provides functionality to automatically generate relevant tags for user questions
 * using OpenAI's GPT-4 model. It helps categorize and organize user queries for better
 * search and retrieval in the knowledge base system.
 */

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  generateUserPromptTagQuestion,
  systemPromptTags,
  developerPromptTagQuestion,
} from "./prompts";

/**
 * Zod schema defining the structure of the tag generation result
 *
 * @property is_valid - Boolean indicating if the question is valid for tag generation
 * @property tags - Array of strings representing the generated tags
 */
const QuestionTagsResult = z.object({
  is_valid: z.boolean(),
  tags: z.array(z.string()),
});

/**
 * TypeScript type derived from the QuestionTagsResult schema
 * Used for type safety throughout the application
 */
type QuestionTagsResultType = z.infer<typeof QuestionTagsResult>;

/**
 * Default result object returned when tag generation fails or is invalid
 * Provides a safe fallback to prevent undefined errors
 */
const nullResult: QuestionTagsResultType = {
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
 * @returns Promise resolving to QuestionTagsResultType containing validation status and tags
 *
 * @example
 * ```typescript
 * const result = await generateTags("How do I implement authentication?", openaiClient);
 * if (result.is_valid) {
 *   console.log("Generated tags:", result.tags);
 * }
 * ```
 */
export const generateTags = async (
  text: string,
  openai: OpenAI
): Promise<QuestionTagsResultType> => {
  // Generate the user prompt by formatting the input text
  const userPrompt = generateUserPromptTagQuestion(text);

  // Make API call to OpenAI with structured prompts and output parsing
  const response = await openai.responses.parse({
    model: "gpt-4o", // Use GPT-4 Omni for optimal tag generation quality
    input: [
      {
        role: "system",
        content: systemPromptTags, // Provides overall context and tag generation rules
      },
      {
        role: "developer",
        content: developerPromptTagQuestion, // Technical guidance for consistent tagging
      },
      {
        role: "user",
        content: userPrompt, // The actual question/text to be tagged
      },
    ],
    // Use Zod schema validation to ensure structured output parsing
    text: { format: zodTextFormat(QuestionTagsResult, "tagsResult") },
  });

  // Return parsed result or fallback to null result if parsing fails
  return response.output_parsed ?? nullResult;
};
