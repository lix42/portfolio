import { Validator } from '@cfworker/json-schema';
import { Container, getContainer } from '@cloudflare/containers';
import type { DurableObjectStub } from 'cloudflare:workers';
import type { FromSchema } from 'json-schema-to-ts';

import jokeRequestSchema from '../schema/joke-request.schema.json';
import jokeResponseSchema from '../schema/joke-response.schema.json';
import type { CloudflareContainerBindings } from '../worker-configuration';

export type JokeRequest = FromSchema<typeof jokeRequestSchema>;
export type JokeResponse = FromSchema<typeof jokeResponseSchema>;

const jokeResponseValidator = new Validator(jokeResponseSchema);

export class FastAPIContainer extends Container<CloudflareContainerBindings> {
  defaultPort = 8000;
  sleepAfter = '5m';

  constructor(state: DurableObjectState, env: CloudflareContainerBindings) {
    super(state, env, {
      defaultPort: 8000,
      sleepAfter: '5m',
      enableInternet: true,
      envVars: {
        OPENAI_API_KEY: env.OPENAI_API_KEY ?? '',
      },
    });
  }
}

type FetchHandler = ExportedHandler<CloudflareContainerBindings>;

const buildJokeRequest = (url: URL): Partial<JokeRequest> => {
  const payload: Partial<JokeRequest> = {};
  const topic = url.searchParams.get('topic');
  const audience = url.searchParams.get('audience');
  if (topic) {
    payload.topic = topic;
  }
  if (audience) {
    payload.audience = audience;
  }
  return payload;
};

const forwardJson = (
  container: DurableObjectStub<FastAPIContainer>,
  pathname: string,
  init?: RequestInit
) => container.fetch(`http://container${pathname}`, init);

const handler: FetchHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const containerStub = getContainer(
      env.MY_FASTAPI_CONTAINER,
      'fastapi-prototype'
    );

    if (url.pathname === '/schema/joke-response') {
      return Response.json(jokeResponseSchema);
    }

    if (url.pathname === '/schema/joke-request') {
      return Response.json(jokeRequestSchema);
    }

    try {
      if (url.pathname === '/api/health') {
        return forwardJson(containerStub, '/health');
      }

      if (url.pathname === '/api/joke') {
        const jokeRequest = buildJokeRequest(url);
        const containerResponse = await forwardJson(containerStub, '/joke', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(jokeRequest),
        });

        if (!containerResponse.ok) {
          return new Response(await containerResponse.text(), {
            status: containerResponse.status,
            headers: {
              'content-type':
                containerResponse.headers.get('content-type') ?? 'text/plain',
            },
          });
        }

        const payload = (await containerResponse.json()) as unknown;
        const validationResult = jokeResponseValidator.validate(payload);
        if (!validationResult.valid) {
          return new Response(
            JSON.stringify({
              error: 'Container response failed schema validation',
              details: validationResult.errors,
            }),
            { status: 502, headers: { 'content-type': 'application/json' } }
          );
        }

        return Response.json(payload as JokeResponse, {
          headers: {
            'cache-control': 'no-store',
          },
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console -- surfaced in Wrangler logs when container provisioning fails.
      console.error('Failed to reach FastAPI container', error);
      return new Response(
        JSON.stringify({
          error: 'Container invocation failed',
        }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.pathname === '/' || url.pathname === '') {
      return Response.json({
        message: 'Cloudflare Worker proxy for FastAPI container',
        routes: [
          '/api/health',
          '/api/joke',
          '/schema/joke-request',
          '/schema/joke-response',
        ],
      });
    }

    return new Response('Not found', { status: 404 });
  },
};

export default handler;
