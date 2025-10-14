import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, test, vi } from 'vitest';
import Entrypoint from './index';

vi.mock('openai', () => {
  class OpenAI {
    embeddings = {
      create: vi.fn(async () => ({
        data: [{ embedding: Array(3).fill(0.1) }],
      })),
    };
  }
  return { default: OpenAI };
});

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      rpc: vi.fn(async () => ({ data: [] })),
    })),
  };
});

describe('Example', () => {
  test('GET /v1', async () => {
    const ctx = createExecutionContext();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    const res = await entrypoint.fetch(new Request('http://localhost/v1'));
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
  });
});
