import type { HealthResponse } from '@portfolio/shared';

import { Welcome } from '../welcome/welcome';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore this tpe is generated with react router codegen
import type { Route } from './+types/home';

// eslint-disable-next-line no-empty-pattern
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const message = context.cloudflare.env.VALUE_FROM_CLOUDFLARE;
  const chatService = context.cloudflare.env.CHAT_SERVICE;
  const endpoint = new URL('/v1/health', 'https://chat-service');

  try {
    const response = await chatService.fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    // TODO: use zod to validate the response
    const payload = (await response.json()) as HealthResponse;

    return {
      message,
      health: {
        ok: payload.ok,
        version: payload.version,
        error: null,
      },
    };
  } catch (error) {
    const messageFromError =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      message,
      health: {
        ok: false,
        version: 'unknown',
        error: messageFromError,
      },
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <Welcome message={loaderData.message} health={loaderData.health} />;
}
