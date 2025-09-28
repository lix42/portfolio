import { Hono } from 'hono';
import chat from './chat';

const app = new Hono().basePath('/v1');

// Custom Not Found Message
app.notFound((c) => {
  return c.text('Custom 404 Not Found', 404);
});

// Error handling
app.onError((err, c) => {
  console.error(`${err}`);
  return c.text('Custom Error Message', 500);
});

// Routing
app.get('/', (c) => c.text('Hono!!'));
app.route('/chat', chat);

export default app;
