// Generates a user prompt for evaluating a behavioral interview question.
export const generateUserPromptProcessQuestion = (
  text: string
): string => `Evaluate the following interview question:
"${text}"`;

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
