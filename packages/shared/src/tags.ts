import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { mapLimit } from "./asyncWorker";
import { TAG_GENERATION_MODEL } from "./constants";
import { DEFINE_TAGS_PROMPT } from "./prompts";

export interface TagGenerationOptions {
  model?: string;
  apiKey?: string;
}

const Tags = z.object({
  tags: z.array(z.string()),
});

/**
 * Generate tags for a single chunk of content
 */
export async function generateTags(
  content: string,
  options: TagGenerationOptions,
  instance?: OpenAI,
): Promise<string[]> {
  const openai = instance ?? new OpenAI({ apiKey: options.apiKey });

  const response = await openai.responses.parse({
    model: options.model ?? TAG_GENERATION_MODEL,
    input: [
      { role: "system", content: DEFINE_TAGS_PROMPT },
      {
        role: "user",
        content: `Extract 3-5 relevant tags from the following content.
Response in JSON format, include property "tags", which value is a string array, like this:
{ tags: ["ownership", "problem solving", "frontend_architecture"] }
content:
${content}`,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent tagging
    text: {
      format: zodTextFormat(Tags, "tags"),
    },
  });

  const tagsText = response.output_parsed?.tags;
  return tagsText?.filter(Boolean) ?? [];
}

/**
 * Generate tags for multiple chunks in batch
 * Uses Promise.all for parallel processing
 */
export async function generateTagsBatch(
  contents: string[],
  options: TagGenerationOptions,
): Promise<string[][]> {
  if (contents.length === 0) {
    return [];
  }

  return mapLimit(contents, 5, (content) => generateTags(content, options));
}

/**
 * Parse tags from LLM response
 * Handles various formats: JSON array, comma-separated, newline-separated
 */
export function parseTags(response: string): string[] {
  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeTag).filter(Boolean);
    }
  } catch {
    // Not JSON, continue with text parsing
  }

  // Extract tags from various formats
  const tags: string[] = [];

  // Pattern 1: comma-separated
  if (response.includes(",")) {
    tags.push(...response.split(",").map((t) => t.trim()));
  }
  // Pattern 2: newline-separated
  else if (response.includes("\n")) {
    tags.push(
      ...response.split("\n").map((t) => t.trim().replace(/^[-*]\s*/, "")),
    );
  }
  // Pattern 3: space-separated
  else {
    tags.push(...response.split(/\s+/));
  }

  return tags.map(normalizeTag).filter((tag) => tag.length > 0);
}

/**
 * Normalize tag format: lowercase, underscores, no special chars
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_\s]/g, "") // Remove special characters
    .replace(/\s+/g, "_"); // Replace spaces with underscores
}
