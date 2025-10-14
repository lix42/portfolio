import { WorkerEntrypoint } from 'cloudflare:workers';
import { Hono } from 'hono';
import chat, { answerQuestion } from './chat';

const app = new Hono<{ Bindings: CloudflareBindings }>().basePath('/v1');

// Custom Not Found Message
app.notFound((c) => {
  return c.text('Custom 404 Not Found', 404);
});

// Error handling
app.onError((err, c) => {
  // eslint-disable-next-line no-console
  console.error(`${err}`);
  return c.text('Custom Error Message', 500);
});

// Routing
app.get('/', (c) => c.text('Hono!!'));
app.route('/chat', chat);

export default class extends WorkerEntrypoint<CloudflareBindings> {
  override fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }

  chat = async (message: string) => {
    return await answerQuestion(message, this.env);
  };
}
