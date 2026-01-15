import { describe, expect, test, vi } from 'vitest';

import Entrypoint from './index';

const createExecutionContext = (): ExecutionContext =>
  ({
    props: {},
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  }) as unknown as ExecutionContext;

const createEnv = (): CloudflareBindings =>
  ({
    ENVIRONMENT: 'development',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_KEY: 'test-key',
    OPENAI_API_KEY: 'test-openai-key',
    DB: {
      prepare: vi.fn(() => ({
        first: vi.fn(async () => ({})),
      })),
    },
    DOCUMENTS: {
      list: vi.fn(async () => ({ objects: [] })),
    },
    VECTORIZE: {
      describe: vi.fn(async () => ({})),
    },
    CF_VERSION_METADATA: { id: 'test' },
  }) as unknown as CloudflareBindings;

// Mock OpenAI
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

// Mock Cloudflare adapters
vi.mock('./adapters', () => ({
  queryByEmbedding: vi.fn(async () => []),
  getChunksByTags: vi.fn(async () => []),
  getChunkByVectorizeId: vi.fn(async () => null),
  getDocumentById: vi.fn(async () => null),
}));

vi.mock('./adapters/r2', () => ({
  getDocumentContent: vi.fn(async () => null),
}));

describe('Service Entrypoint', () => {
  test('GET /v1 returns success', async () => {
    const ctx = createExecutionContext();
    const env = createEnv();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    const res = await entrypoint.fetch(new Request('http://localhost/v1'));
    expect(res.status).toBe(200);
  });

  test('GET /v1/health returns ok status', async () => {
    const ctx = createExecutionContext();
    const env = createEnv();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    const res = await entrypoint.fetch(
      new Request('http://localhost/v1/health')
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const json = await res.json();
    expect(json).toMatchObject({
      ok: expect.any(Boolean),
      version: expect.any(String),
      services: {
        d1: { ok: expect.any(Boolean) },
        r2: { ok: expect.any(Boolean) },
        vectorize: { ok: expect.any(Boolean) },
      },
    });
  });

  test('POST /v1/chat endpoint exists and validates input', async () => {
    const ctx = createExecutionContext();
    const env = createEnv();
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
    // Zod validator should return 400 for missing message
    expect(res.status).toBe(400);
  });

  test('RPC health method returns ok status', async () => {
    const ctx = createExecutionContext();
    const env = createEnv();
    const entrypoint = new Entrypoint(
      ctx,
      env as unknown as CloudflareBindings
    );
    const result = await entrypoint.health();
    expect(result).toMatchObject({
      ok: expect.any(Boolean),
      version: expect.any(String),
      services: {
        d1: { ok: expect.any(Boolean) },
        r2: { ok: expect.any(Boolean) },
        vectorize: { ok: expect.any(Boolean) },
      },
    });
  });
});
