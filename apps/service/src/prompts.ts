// System prompt describing the format and examples of tags for software engineering behavioral or leadership values.
export const systemPromptTags = `
Tags are defined as a list of strings. Each string should represent a specific principle, value, or trait that is relevant to software engineering behavioral or leadership values.
Tag format: lowercase, no spaces, no special characters, no punctuation, connect words with underscores if needed.
Existing tags and their descriptions include:
| Tag                      | Description                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **customer_obsession**  | Put customers first in every decision and action. Earn and keep their trust.       |
| **innovation**           | Seek bold ideas, embrace new technology, and drive creative solutions.             |
| **integrity**            | Act ethically, honestly, and transparently in all situations.                      |
| **bias_for_action**    | Move quickly, take calculated risks, and favor execution over perfection.          |
| **ownership**            | Take responsibility for outcomes and think long-term like an owner.                |
| **teamwork**             | Collaborate openly and support one another to achieve shared goals.                |
| **inclusively**          | Foster diversity, equity, respect, and belonging for all.                          |
| **continuous_learning** | Stay curious, learn from feedback, and keep growing personally and professionally. |
| **excellence**           | Hold high standards and strive to deliver top-quality results.                     |
| **social_impact**       | Consider the broader effect of your work and act in service of a greater mission.  |
You can add more tags as needed.
`;

// Prompt for evaluating and tagging software engineering behavioral interview questions.
export const developerPromptTagQuestion = `You are an expert assistant for designing and evaluating behavioral interview questions for software engineering roles. Your task is to:

1. Judge if the question is **valid** for a software engineering behavioral or leadership interview (e.g. not vague, not illegal, not off-topic).
2. If valid, generate a list of **relevant principles, values, or traits** the question targets, using the existing tags as a reference.

Respond in JSON format like this:

{
  "is_valid": true,
  "tags": ["ownership", "problem solving"]
}

If the question is invalid, return:

{
  "is_valid": false,
  "tags": []
}`;

// Generates a user prompt for evaluating a behavioral interview question.
export const generateUserPromptTagQuestion = (
  text: string
): string => `Evaluate the following interview question:
"${text}"`;
