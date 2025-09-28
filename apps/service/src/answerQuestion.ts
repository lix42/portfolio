import type OpenAI from 'openai';
import {
  generateUserPromptAnswerQuestion,
  systemPromptAnswerQuestion,
} from './utils/prompts';
import type {
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseOutputText,
} from 'openai/resources/responses/responses.mjs';

export const answerQuestionWithChunks = async (
  context: string[],
  question: string,
  openai: OpenAI
) => {
  const systemPrompt = systemPromptAnswerQuestion;
  const userPrompt = generateUserPromptAnswerQuestion(context, question);
  const response = await openai.responses.create({
    model: 'gpt-4o',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return response.output;
};

export const answerQuestionWithWholeDocument = async (
  document: string,
  question: string,
  openai: OpenAI
) => {
  const systemPrompt = systemPromptAnswerQuestion;
  const userPrompt = generateUserPromptAnswerQuestion([document], question);
  const response = await openai.responses.create({
    model: 'gpt-4o',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return response.output;
};

export const extractAssistantAnswer = (output: ResponseOutputItem[]) => {
  return output
    .filter(
      (o): o is ResponseOutputMessage =>
        o.type === 'message' &&
        o.role === 'assistant' &&
        o.status === 'completed'
    )
    .flatMap((o) => o.content)
    .filter((c): c is ResponseOutputText => c.type === 'output_text')
    .map((c) => c.text)
    .join('\n\n');
};
