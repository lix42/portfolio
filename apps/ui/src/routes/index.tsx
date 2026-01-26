import { env } from "cloudflare:workers";
import { type ChatRequest, ChatResponseSchema } from "@portfolio/shared";
import { createFileRoute } from "@tanstack/react-router";

import { Card } from "~/components/ui/card";
import { healthQueryOptions } from "~/lib/health";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData(healthQueryOptions);

    return data;
  },
  component: Home,
});

function Home() {
  const question =
    "Tell me an example about how you cooperate with other people.";

  return (
    <Card className="px-2 sm:px-4">
      <h2 className="text-xl text-primary font-bold">{question}</h2>'
    </Card>
  );
}

async function answerQuestion(question: string) {
  const endpoint = new URL("/v1/chat", "https://chat-service");
  const requestBody: ChatRequest = { message: question };

  const response = await env.CHAT_SERVICE.fetch(endpoint.toString(), {
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
}
