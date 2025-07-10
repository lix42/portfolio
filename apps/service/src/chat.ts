import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import OpenAI from "openai";
import { embed } from "./embed";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const schema = z.object({
  message: z.string(),
});

app.post("/", zValidator("json", schema), async (c) => {
  const { message } = c.req.valid("json");
  const openai = new OpenAI({ apiKey: c.env.OPENAI_API_KEY });

  const embedding = await embed(message, openai);

  if (!embedding) {
    return c.json({ error: "Failed to create embedding" }, 500);
  }

  return c.text(`
post a message: ${message}
embedding: ${embedding.map((num) => num.toFixed(6)).join(", ")}
`);
});

export default app;
