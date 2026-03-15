import { createFileRoute } from "@tanstack/react-router";

import { createChatProxyHandler } from "../../lib/chatProxy";

export const Route = createFileRoute("/api/chat-jsonl")({
  server: {
    handlers: {
      POST: createChatProxyHandler({
        endpoint: "/v1/chat/jsonl",
        contentType: "application/x-ndjson",
        logTag: "chat-jsonl proxy",
      }),
    },
  },
});
