import type { StreamEvent } from "@portfolio/shared";
import OpenAI from "openai";

import { answerQuestionStreaming } from "./answerQuestion";
import { getContext } from "./getContext";
import { preprocessQuestion } from "./preprocessQuestion";
import { embed } from "./utils/embed";

type OnEvent = (event: StreamEvent) => Promise<void>;

export async function runChatPipeline(params: {
  message: string;
  env: CloudflareBindings;
  signal: AbortSignal;
  requestId: string;
  onEvent: OnEvent;
}): Promise<void> {
  const { message, env, signal, requestId, onEvent } = params;
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  await onEvent({ event: "init", data: { requestId } });

  await onEvent({
    event: "status",
    data: { step: "preprocessing", message: "Analyzing question..." },
  });

  const [preprocessResult, embedding] = await Promise.all([
    preprocessQuestion(message, openai),
    embed(message, openai),
  ]);

  if (signal.aborted) return;

  await onEvent({
    event: "preprocessed",
    data: {
      tags: preprocessResult?.tags ?? [],
      isValid: preprocessResult?.is_valid ?? false,
    },
  });

  if (!preprocessResult?.is_valid) {
    await onEvent({
      event: "error",
      data: { error: "Invalid question", code: 400, requestId },
    });
    return;
  }

  if (!embedding) {
    await onEvent({
      event: "error",
      data: { error: "Failed to create embedding", code: 500, requestId },
    });
    return;
  }

  if (signal.aborted) return;

  await onEvent({
    event: "status",
    data: { step: "searching", message: "Searching documents..." },
  });

  const { topChunks } = await getContext(embedding, preprocessResult.tags, env);

  if (signal.aborted) return;

  await onEvent({
    event: "context",
    data: {
      chunksCount: topChunks?.length ?? 0,
      documentFound: topChunks !== null,
    },
  });

  if (!topChunks) {
    await onEvent({
      event: "error",
      data: { error: "No relevant documents found", code: 404, requestId },
    });
    return;
  }

  await onEvent({
    event: "status",
    data: { step: "generating", message: "Generating answer..." },
  });

  let fullAnswer = "";
  for await (const chunk of answerQuestionStreaming(
    topChunks,
    message,
    openai,
    signal,
  )) {
    if (signal.aborted) return;
    fullAnswer += chunk;
    await onEvent({ event: "chunk", data: { text: chunk } });
  }

  await onEvent({ event: "done", data: { answer: fullAnswer } });
}
