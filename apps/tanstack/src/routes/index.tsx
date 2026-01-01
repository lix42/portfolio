import type { HealthResponse } from '@portfolio/shared';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

import type { ServiceHealth } from '~/components/HealthStatus';
import { HealthStatus } from '~/components/HealthStatus';

interface LoaderData {
  message: string;
  health: ServiceHealth;
}

const fetchHealth = createServerFn({ method: 'GET' }).handler(async () => {
  const message = env.VALUE_FROM_CLOUDFLARE ?? 'Hello from Cloudflare';
  const endpoint = new URL('/v1/health', 'https://chat-service');

  try {
    const response = await env.CHAT_SERVICE.fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as HealthResponse;

    const health: ServiceHealth = {
      ok: payload.ok,
      version: payload.version,
      error: null,
    };

    return { message, health } satisfies LoaderData;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    const health: ServiceHealth = {
      ok: false,
      version: 'unknown',
      error: errorMessage,
    };

    return { message, health } satisfies LoaderData;
  }
});

export const Route = createFileRoute('/')({
  loader: () => fetchHealth(),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();

  return <HealthStatus message={data.message} health={data.health} />;
}
