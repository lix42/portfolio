import { env } from "cloudflare:workers";
import { ChatRequestSchema } from "@portfolio/shared";

interface ChatProxyOptions {
  /** Service endpoint path, e.g. "/v1/chat/sse" */
  endpoint: string;
  /** Content-Type for the streamed response */
  contentType: string;
  /** Log prefix for error messages, e.g. "chat proxy" */
  logTag: string;
}

/**
 * Creates a POST handler that validates the request, proxies it to the
 * chat service binding, and streams back the response.
 */
export function createChatProxyHandler(
  options: ChatProxyOptions,
): (ctx: { request: Request }) => Promise<Response> {
  const { endpoint, contentType, logTag } = options;

  return async ({ request }) => {
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
      const url = new URL(endpoint, "https://chat-service");
      response = await env.CHAT_SERVICE.fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
    } catch (err) {
      console.error(`[${logTag}] service binding fetch failed:`, err);
      return Response.json(
        { error: "Chat service is unavailable" },
        { status: 502 },
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      console.error(
        `[${logTag}] service returned ${response.status}:`,
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
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  };
}
