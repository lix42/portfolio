import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import OpenAI from "openai";
import { embed } from "./embed";
import { createClient } from "@supabase/supabase-js";
import { generateTags } from "./generateTags";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const schema = z.object({
  message: z.string(),
});

app.post("/", zValidator("json", schema), async (c) => {
  const { message } = c.req.valid("json");
  const openai = new OpenAI({ apiKey: c.env.OPENAI_API_KEY });
  const supabaseClient = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY, {
    global: {
      fetch: (...args) => fetch(...args),
    },
  });

  const [tags, embedding] = await Promise.all([
    generateTags(message, openai),
    embed(message, openai),
  ]);

  if (!tags?.is_valid) {
    return c.json({ error: "Invalid question" }, 400);
  }

  if (!embedding) {
    return c.json({ error: "Failed to create embedding" }, 500);
  }

  const response = await supabaseClient.rpc("match_chunks", {
    query_embedding: embedding, // Pass the embedding you want to compare
    match_threshold: 0.2, // Choose an appropriate threshold for your data
    match_count: 5, // Choose the number of matches
  });

  return c.json({
    message,
    tags: tags.tags,
    response: response.data || [],
  });
});

export default app;
