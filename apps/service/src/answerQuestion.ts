import {
  ANSWER_GENERATION_MODEL,
  ANSWER_QUESTION_PROMPT,
} from "@portfolio/shared";
import type OpenAI from "openai";
import type {
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseOutputText,
} from "openai/resources/responses/responses.mjs";

import { generateUserPromptAnswerQuestion } from "./utils/prompts";

export const answerQuestionWithChunks = async (
  context: string[],
  question: string,
  openai: OpenAI,
) => {
  const userPrompt = generateUserPromptAnswerQuestion(context, question);
  const response = await openai.responses.create({
    model: ANSWER_GENERATION_MODEL,
    input: [
      { role: "system", content: ANSWER_QUESTION_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  return response.output;
};

export const answerQuestionWithWholeDocument = async (
  document: string,
  question: string,
  openai: OpenAI,
) => {
  const userPrompt = generateUserPromptAnswerQuestion([document], question);
  const response = await openai.responses.create({
    model: ANSWER_GENERATION_MODEL,
    input: [
      { role: "system", content: ANSWER_QUESTION_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  return response.output;
};

export async function* answerQuestionStreaming(
  context: string[],
  question: string,
  openai: OpenAI,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const userPrompt = generateUserPromptAnswerQuestion(context, question);
  const stream = await openai.responses.create({
    model: ANSWER_GENERATION_MODEL,
    input: [
      { role: "system", content: ANSWER_QUESTION_PROMPT },
      { role: "user", content: userPrompt },
    ],
    stream: true,
  });

  // Abort the OpenAI stream when signal fires
  signal?.addEventListener("abort", () => {
    stream.controller.abort();
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}

export const extractAssistantAnswer = (output: ResponseOutputItem[]) => {
  return output
    .filter(
      (o): o is ResponseOutputMessage =>
        o.type === "message" &&
        o.role === "assistant" &&
        o.status === "completed",
    )
    .flatMap((o) => o.content)
    .filter((c): c is ResponseOutputText => c.type === "output_text")
    .map((c) => c.text)
    .join("\n\n");
};
