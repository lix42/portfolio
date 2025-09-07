import prompts from "@documents/prompts.json";

const joinPrompts = (prompts: unknown) =>
  Array.isArray(prompts)
    ? prompts.join("\n")
    : typeof prompts === "string"
    ? prompts
    : "";

// System prompt describing the format and examples of tags for software engineering behavioral or leadership values.
export const systemPromptTags = joinPrompts(prompts.defineTags);

// Prompt for evaluating and tagging software engineering behavioral interview questions.
export const developerPromptTagQuestion = joinPrompts(prompts.judgeQuestionAndAddTags);

// Generates a user prompt for evaluating a behavioral interview question.
export const generateUserPromptTagQuestion = (
  text: string
): string => `Evaluate the following interview question:
"${text}"`;
