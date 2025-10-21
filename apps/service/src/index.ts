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

// Health check function
const health = () => {
  return { ok: true };
};

// Routing
app.get('/', (c) => c.text('Hono!!'));
app.get('/health', (c) => c.json(health()));
app.route('/chat', chat);

export default class extends WorkerEntrypoint<CloudflareBindings> {
  override fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }

  health = async () => {
    return health();
  };

  chat = async (message: string) => {
    return await answerQuestion(message, this.env);
  };
}
