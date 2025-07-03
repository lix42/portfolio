import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { etag } from "hono/etag";
import { poweredBy } from "hono/powered-by";
import { prettyJSON } from "hono/pretty-json";

const app = new Hono();

// Mount Builtin Middleware
app.use("*", poweredBy());

// Add X-Response-Time header
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  c.header("X-Response-Time", `${ms}ms`);
});

// Custom Not Found Message
app.notFound((c) => {
  return c.text("Custom 404 Not Found", 404);
});

// Error handling
app.onError((err, c) => {
  console.error(`${err}`);
  return c.text("Custom Error Message", 500);
});

// Routing
app.get("/", (c) => c.text("Hono!!"));

export default app;
