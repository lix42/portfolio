import { env } from "cloudflare:workers";
import { ChatRequestSchema } from "@portfolio/shared";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "Request body must be valid JSON" },
            { status: 400 },
          );
        }

        const parsed = ChatRequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid request", details: parsed.error.issues },
            { status: 400 },
          );
        }

        let response: Response;
        try {
          const endpoint = new URL("/v1/chat/sse", "https://chat-service");
          response = await env.CHAT_SERVICE.fetch(endpoint.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          });
        } catch (err) {
          console.error("[chat proxy] service binding fetch failed:", err);
          return Response.json(
            { error: "Chat service is unavailable" },
            { status: 502 },
          );
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "Unknown error");
          console.error(
            `[chat proxy] service returned ${response.status}:`,
            errorBody,
          );
          return Response.json(
            { error: "Chat service error" },
            { status: response.status >= 500 ? 502 : response.status },
          );
        }

        if (!response.body) {
          return Response.json(
            { error: "No response stream from service" },
            { status: 502 },
          );
        }

        return new Response(response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
