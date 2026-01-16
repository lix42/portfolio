/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Create mock Env for testing
 */
export function createMockEnv(): Env {
  return {
    DOCUMENTS_BUCKET: createMockR2Bucket(),
    DB: createMockD1Database(),
    VECTORIZE: createMockVectorize(),
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
    DOCUMENT_PROCESSOR: {} as any, // Not used in unit tests
    PROCESSING_QUEUE: createMockQueue(),
    OPENAI_API_KEY: "test-api-key",
    ENVIRONMENT: "test",
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    CLOUDFLARE_API_TOKEN: "test-api-token",
    R2_ACCESS_KEY_ID: "test-access-id",
    R2_SECRET_ACCESS_KEY: "test-access-key",
  };
}

function createMockR2Bucket() {
  const storage = new Map<string, string>();

  return {
    get: async (key: string) => {
      const content = storage.get(key);
      if (!content) {
        return null;
      }

      return {
        text: async () => content,
        customMetadata: {
          project: "Test Project",
          company: "Test Company",
        },
        checksums: {
          sha256: "test-hash",
        },
        etag: "test-etag",
      };
    },
    put: async (key: string, value: string) => {
      storage.set(key, value);
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
  } as any;
}

function createMockD1Database() {
  return {
    prepare: (_sql: string) => ({
      // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
      bind: (..._args: any[]) => ({
        first: async () => ({ id: 1 }),
        run: async () => ({ meta: { changes: 1 } }),
      }),
    }),
    // biome-ignore lint/suspicious/noExplicitAny: Mock doesn't implement full D1Database interface
  } as any;
}

function createMockVectorize() {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
    upsert: async (_vectors: any[]) => ({}),
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
  } as any;
}

function createMockQueue() {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
    send: async (_message: any) => ({}),
    // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
  } as any;
}
