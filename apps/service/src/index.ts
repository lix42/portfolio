import { WorkerEntrypoint } from "cloudflare:workers";
import { healthResponseSchema } from "@portfolio/shared";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";

import chat, { answerQuestion } from "./chat";
import type { ChatServiceBinding } from "./chatServiceBinding";
import { health } from "./health";
import { openAPIConfig } from "./openapi/config";

export * from "./fetchResponseTypes";

// Create main app (for OpenAPI endpoint at root level)
const main = new Hono<{ Bindings: CloudflareBindings }>();

// Create v1 app with basePath
const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/v1");

// Custom Not Found Message
app.notFound((c) => {
  return c.text("Custom 404 Not Found", 404);
});

// Error handling
app.onError((err, c) => {
  // eslint-disable-next-line no-console
  console.error(`${err}`);
  let status: ContentfulStatusCode = 500;
  if ("status" in err && Number.isFinite(err.status)) {
    status = err.status as ContentfulStatusCode;
  }
  let error = err;
  if ("error" in err) {
    error = err.error as Error;
  }
  let message = "Custom Error Message";
  if ("message" in error && typeof error.message === "string") {
    message = error.message;
  }
  let stack: string | undefined;
  if ("stack" in error) {
    stack = error.stack as string | undefined;
  }
  return c.json({ message, status, stack, error }, 500);
});

// Routing
app.get("/", (c) => c.text("Hono!!"));
app.get(
  "/health",
  describeRoute({
    summary: "Health check endpoint",
    description:
      "Returns service health status and version information for monitoring and uptime checks",
    tags: ["Health"],
    responses: {
      200: {
        description: "Service is healthy and operational",
        content: {
          "application/json": {
            schema: resolver(healthResponseSchema),
          },
        },
      },
    },
  }),
  async (c) => c.json(await health(c.env)),
);
app.route("/chat", chat);

// Mount v1 app to main app
main.route("/", app);

// Add OpenAPI spec endpoint at root level
main.get(
  "/openapi.json",
  openAPIRouteHandler(app, { documentation: openAPIConfig }),
);

// Add interactive API documentation UI
main.get(
  "/scalar",
  Scalar({
    url: "/openapi.json",
    theme: "purple",
  }),
);

export default class
  extends WorkerEntrypoint<CloudflareBindings>
  implements ChatServiceBinding
{
  override fetch(
    request: Request | string | URL,
  ): Response | Promise<Response> {
    let requestToFetch: Request;
    if (typeof request === "string" || request instanceof URL) {
      requestToFetch = new Request(request);
    } else {
      requestToFetch = request;
    }
    return main.fetch(requestToFetch, this.env, this.ctx);
  }

  health = async () => {
    return await health(this.env);
  };

  chat = async (message: string) => {
    return await answerQuestion(message, this.env);
  };
}
