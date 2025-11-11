import { WorkerEntrypoint } from 'cloudflare:workers';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import chat, { answerQuestion } from './chat';
import type { ChatServiceBinding } from './chatServiceBinding';
import { health } from './health';

export * from './fetchResponseTypes';

const app = new Hono<{ Bindings: CloudflareBindings }>().basePath('/v1');

// Custom Not Found Message
app.notFound((c) => {
  return c.text('Custom 404 Not Found', 404);
});

// Error handling
app.onError((err, c) => {
  // eslint-disable-next-line no-console
  console.error(`${err}`);
  let status: ContentfulStatusCode = 500;
  if ('status' in err && Number.isFinite(err.status)) {
    status = err.status as ContentfulStatusCode;
  }
  let error = err;
  if ('error' in err) {
    error = err.error as Error;
  }
  let message = 'Custom Error Message';
  if ('message' in error && typeof error.message === 'string') {
    message = error.message;
  }
  let stack = [];
  if ('stack' in error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stack = error.stack as any;
  }
  return c.json({ message, status, stack, error }, 500);
});

// Routing
app.get('/', (c) => c.text('Hono!!'));
app.get('/health', (c) =>
  c.json(health(JSON.stringify(c.env.CF_VERSION_METADATA)))
);
app.route('/chat', chat);

export default class
  extends WorkerEntrypoint<CloudflareBindings>
  implements ChatServiceBinding
{
  override fetch(
    request: Request | string | URL
  ): Response | Promise<Response> {
    let requestToFetch: Request;
    if (typeof request === 'string' || request instanceof URL) {
      requestToFetch = new Request(request);
    } else {
      requestToFetch = request;
    }
    return app.fetch(requestToFetch, this.env, this.ctx);
  }

  health = async () => {
    return health(JSON.stringify(this.env.CF_VERSION_METADATA));
  };

  chat = async (message: string) => {
    return await answerQuestion(message, this.env);
  };
}
