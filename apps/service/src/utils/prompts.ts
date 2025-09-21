import prompts from '@documents/prompts.json';

const joinPrompts = (prompts: unknown) =>
  Array.isArray(prompts)
    ? prompts.join('\n')
    : typeof prompts === 'string'
      ? prompts
      : '';

// System prompt describing the format and examples of tags for software engineering behavioral or leadership values.
export const systemPromptTags = joinPrompts(prompts.defineTags);

// Prompt for evaluating and tagging software engineering interview questions.
export const developerPromptProcessQuestion = joinPrompts(
  prompts.preprocessQuestion
);

// Generates a user prompt for evaluating a behavioral interview question.
export const generateUserPromptProcessQuestion = (
  text: string
): string => `Evaluate the following interview question:
"${text}"`;

// Prompt for answering questions based on the provided context.
export const systemPromptAnswerQuestion = joinPrompts(prompts.answerQuestion);

// Generates a user prompt for answering questions based on the provided context.
export const generateUserPromptAnswerQuestion = (
  context: string[],
  question: string
): string => `Answer the following question based on the provided context:
Context:
"""
${context.join('\n\n')}
"""

Question:
"""
${question}
"""`;
