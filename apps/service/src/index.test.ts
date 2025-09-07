import { describe, expect, test, vi } from "vitest";

vi.mock("openai", () => {
  class OpenAI {
    embeddings = {
      create: vi.fn(async () => ({
        data: [{ embedding: Array(3).fill(0.1) }],
      })),
    };
  }
  return { default: OpenAI };
});

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      rpc: vi.fn(async () => ({ data: [] })),
    })),
  };
});

import app from "./index";

describe("Example", () => {
  test("GET /v1", async () => {
    const res = await app.request("http://localhost/v1");
    expect(res.status).toBe(200);
  });
});
