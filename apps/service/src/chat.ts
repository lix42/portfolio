import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const schema = z.object({
  message: z.string(),
});

app.post("/", zValidator("json", schema), (c) => {
  const { message } = c.req.valid("json");
  return c.text(`post a message: ${message}`);
});

export default app;
