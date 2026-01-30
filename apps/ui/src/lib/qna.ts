import { env } from "cloudflare:workers";
import {
  type ChatRequest,
  type ChatResponse,
  ChatResponseSchema,
} from "@portfolio/shared";
import { createServerFn } from "@tanstack/react-start";

const answerQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: { question: string }) => data)
  .handler(async ({ data }): Promise<ChatResponse> => {
    const { question } = data;
    const endpoint = new URL("/v1/chat", "https://chat-service");
    const requestBody: ChatRequest = { message: question };

    const response = await env.CHAT_SERVICE.fetch(endpoint.toString(), {
      // const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const result = ChatResponseSchema.safeParse(await response.json());
    if (!result.success) {
      throw new Error(`Invalid response: ${result.error.message}`);
    }

    return result.data;
  });

export const answerQueryOptions = (question: string) => ({
  queryKey: ["answer", question],
  queryFn: () => {
    return answerQuestion({ data: { question } });
  },
});
