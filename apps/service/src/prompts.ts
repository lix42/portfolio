import prompts from "../../../documents/prompts.json";

// System prompt describing the format and examples of tags for software engineering behavioral or leadership values.
export const systemPromptTags = prompts.defineTags;

// Prompt for evaluating and tagging software engineering behavioral interview questions.
export const developerPromptTagQuestion = prompts.judgeQuestionAndAddTags;

// Generates a user prompt for evaluating a behavioral interview question.
export const generateUserPromptTagQuestion = (
  text: string
): string => `Evaluate the following interview question:
"${text}"`;
