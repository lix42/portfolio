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

describe('Service Entrypoint', () => {
  test('GET /v1 returns success', async () => {
    const ctx = createExecutionContext();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    const res = await entrypoint.fetch(new Request('http://localhost/v1'));
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
  });

  test('GET /v1/health returns ok status', async () => {
    const ctx = createExecutionContext();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    const res = await entrypoint.fetch(
      new Request('http://localhost/v1/health')
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const json = await res.json();
    expect(json).toEqual({ ok: true, version: expect.any(String) });
  });

  test('POST /v1/chat endpoint exists and validates input', async () => {
    const ctx = createExecutionContext();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    // Test without message (should fail validation)
    const res = await entrypoint.fetch(
      new Request('http://localhost/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    await waitOnExecutionContext(ctx);
    // Zod validator should return 400 for missing message
    expect(res.status).toBe(400);
  });

  test('RPC health method returns ok status', async () => {
    const ctx = createExecutionContext();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    const result = await entrypoint.health();
    await waitOnExecutionContext(ctx);
    expect(result).toEqual({ ok: true, version: expect.any(String) });
  });
});
