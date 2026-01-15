import { Validator } from '@cfworker/json-schema';
import { Container, getContainer } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

import jokeRequestSchema from '../schema/joke-request.schema.json';
import jokeResponseSchema from '../schema/joke-response.schema.json';

export type JokeRequest = {
  topic?: string;
  audience?: string;
};

export type JokeResponse = {
  id: string;
  message: string;
  source: 'openai' | 'fallback';
};

const jokeResponseValidator = new Validator(jokeResponseSchema as any);

export class FastAPIContainer extends Container<Env> {
  override defaultPort = 8000;
  override sleepAfter = '5m';
  override enableInternet = true;
  override envVars = {
    OPENAI_API_KEY: env.OPENAI_API_KEY,
  };
}

type FetchHandler = ExportedHandler<Env>;

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
      'fastapi-prototype-v1'
    );
    const pathname = url.pathname;

    if (pathname === '/schema/joke-response') {
      return Response.json(jokeResponseSchema);
    }

    if (pathname === '/schema/joke-request') {
      return Response.json(jokeRequestSchema);
    }

    if (pathname === '/debug/worker-env') {
      return Response.json({
        module_env_keys: Object.keys(env),
        module_env_has_OPENAI_API_KEY: 'OPENAI_API_KEY' in env,
        module_env_OPENAI_API_KEY_type: typeof env.OPENAI_API_KEY,
        module_env_OPENAI_API_KEY_value: env.OPENAI_API_KEY
          ? `${String(env.OPENAI_API_KEY).substring(0, 7)}...`
          : null,
        handler_env_keys: Object.keys(env),
        handler_env_has_OPENAI_API_KEY: 'OPENAI_API_KEY' in env,
      });
    }

    try {
      if (pathname === '/api/health') {
        return forwardJson(containerStub, '/health');
      }

      if (pathname === '/api/debug/env') {
        return forwardJson(containerStub, '/debug/env');
      }

      if (pathname === '/api/joke') {
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

    if (pathname === '/' || pathname === '') {
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
