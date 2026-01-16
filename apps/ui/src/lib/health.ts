import { env } from "cloudflare:workers";
import type { HealthResponse } from "@portfolio/shared";
import { createServerFn } from "@tanstack/react-start";

interface LoaderData {
  message: string;
  errorMessage?: string;
  health: HealthResponse;
}

const fetchHealth = createServerFn({ method: "GET" }).handler(async () => {
  const message = env.VALUE_FROM_CLOUDFLARE ?? "Hello from Cloudflare";
  const endpoint = new URL("/v1/health", "https://chat-service");

  try {
    const response = await env.CHAT_SERVICE.fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const health = (await response.json()) as HealthResponse;

    return { message, health } satisfies LoaderData;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const health: HealthResponse = {
      ok: false,
      version: "unknown",
      services: {
        d1: { ok: false },
        r2: { ok: false },
        vectorize: { ok: false },
      },
    };

    return { message, health, errorMessage } satisfies LoaderData;
  }
});

export const healthQueryOptions = {
  queryKey: ["health"],
  queryFn: () => fetchHealth(),
  refetchInterval: 3_000, // Refetch every 3 seconds
};
