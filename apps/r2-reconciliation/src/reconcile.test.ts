import { beforeEach, describe, expect, it, vi } from "vitest";

import { reconcileR2Documents } from "./reconcile";
import type { ProcessingStatus } from "./types";

/**
 * Create a mock Env with configurable behavior
 */
function createMockEnv(options: {
  r2Objects?: Array<{ key: string }>;
  d1Results?: Map<string, { id: number } | null>;
  doStatuses?: Map<string, ProcessingStatus>;
}) {
  const {
    r2Objects = [],
    d1Results = new Map(),
    doStatuses = new Map(),
  } = options;

  const mockStub = (r2Key: string) => ({
    fetch: vi.fn(async (url: string, _init?: RequestInit) => {
      const path = new URL(url).pathname;

      if (path === "/status") {
        const status =
          doStatuses.get(r2Key) ?? createDefaultStatus("not_started");
        return new Response(JSON.stringify(status), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (path === "/process" || path === "/resume") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    }),
  });

  return {
    DOCUMENTS_BUCKET: {
      list: vi.fn(async ({ cursor }: { cursor?: string }) => {
        // Return all objects on first call, empty on subsequent
        if (!cursor) {
          return {
            objects: r2Objects,
            truncated: false,
            cursor: undefined,
          };
        }
        return { objects: [], truncated: false, cursor: undefined };
      }),
    },
    DB: {
      prepare: vi.fn((_sql: string) => ({
        bind: vi.fn((...args: unknown[]) => ({
          first: vi.fn(async () => {
            const r2Key = args[0] as string;
            return d1Results.get(r2Key) ?? null;
          }),
        })),
      })),
    },
    DOCUMENT_PROCESSOR: {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn((id: { name: string }) => mockStub(id.name)),
    },
    ENVIRONMENT: "test",
  } as unknown as Env;
}

function createDefaultStatus(
  status: ProcessingStatus["status"],
  startedAt?: string,
): ProcessingStatus {
  return {
    status,
    currentStep: "download",
    progress: { totalChunks: 0, processedChunks: 0, percentage: 0 },
    errors: [],
    timing: { startedAt },
  };
}

describe("reconcileR2Documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip non-markdown files", async () => {
    const env = createMockEnv({
      r2Objects: [
        { key: "documents/test.json" },
        { key: "documents/image.png" },
        { key: "documents/data.csv" },
      ],
    });

    const result = await reconcileR2Documents(env);

    expect(result.checked).toBe(0);
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("should skip documents already in D1", async () => {
    const d1Results = new Map([["documents/existing.md", { id: 1 }]]);

    const env = createMockEnv({
      r2Objects: [{ key: "documents/existing.md" }],
      d1Results,
    });

    const result = await reconcileR2Documents(env);

    expect(result.checked).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.queued).toBe(0);
  });

  it("should queue documents with not_started status", async () => {
    const doStatuses = new Map([
      ["documents/new.md", createDefaultStatus("not_started")],
    ]);

    const env = createMockEnv({
      r2Objects: [{ key: "documents/new.md" }],
      doStatuses,
    });

    const result = await reconcileR2Documents(env);

    expect(result.checked).toBe(1);
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("should queue documents with failed status", async () => {
    const doStatuses = new Map([
      ["documents/failed.md", createDefaultStatus("failed")],
    ]);

    const env = createMockEnv({
      r2Objects: [{ key: "documents/failed.md" }],
      doStatuses,
    });

    const result = await reconcileR2Documents(env);

    expect(result.checked).toBe(1);
    expect(result.queued).toBe(1);
  });

  it("should skip documents currently processing (< 24h)", async () => {
    const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const doStatuses = new Map([
      [
        "documents/processing.md",
        createDefaultStatus("processing", recentTime),
      ],
    ]);

    const env = createMockEnv({
      r2Objects: [{ key: "documents/processing.md" }],
      doStatuses,
    });

    const result = await reconcileR2Documents(env);

    expect(result.checked).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.retried).toBe(0);
  });

  it("should retry stuck documents (processing > 24h)", async () => {
    const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(); // 25 hours ago
    const doStatuses = new Map([
      ["documents/stuck.md", createDefaultStatus("processing", oldTime)],
    ]);

    const env = createMockEnv({
      r2Objects: [{ key: "documents/stuck.md" }],
      doStatuses,
    });

    const result = await reconcileR2Documents(env);

    expect(result.checked).toBe(1);
    expect(result.retried).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("should handle multiple documents with mixed states", async () => {
    const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString();
    const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString();

    const d1Results = new Map([["documents/existing.md", { id: 1 }]]);

    const doStatuses = new Map<string, ProcessingStatus>([
      ["documents/new.md", createDefaultStatus("not_started")],
      ["documents/failed.md", createDefaultStatus("failed")],
      [
        "documents/processing.md",
        createDefaultStatus("processing", recentTime),
      ],
      ["documents/stuck.md", createDefaultStatus("processing", oldTime)],
    ]);

    const env = createMockEnv({
      r2Objects: [
        { key: "documents/existing.md" },
        { key: "documents/new.md" },
        { key: "documents/failed.md" },
        { key: "documents/processing.md" },
        { key: "documents/stuck.md" },
        { key: "documents/image.png" }, // Should be ignored
      ],
      d1Results,
      doStatuses,
    });

    const result = await reconcileR2Documents(env);

    expect(result.checked).toBe(5); // 5 markdown files
    expect(result.skipped).toBe(2); // existing + processing
    expect(result.queued).toBe(2); // new + failed
    expect(result.retried).toBe(1); // stuck
  });

  it("should handle R2 pagination", async () => {
    // Create mock that returns objects in batches
    let callCount = 0;
    const env = createMockEnv({});

    env.DOCUMENTS_BUCKET.list = vi.fn(
      async ({ cursor: _cursor }: { cursor?: string }) => {
        callCount++;
        if (callCount === 1) {
          return {
            objects: [{ key: "documents/batch1.md" }],
            truncated: true,
            cursor: "cursor1",
          };
        }
        if (callCount === 2) {
          return {
            objects: [{ key: "documents/batch2.md" }],
            truncated: false,
            cursor: undefined,
          };
        }
        return { objects: [], truncated: false, cursor: undefined };
      },
    );

    const result = await reconcileR2Documents(env);

    expect(callCount).toBe(2);
    expect(result.checked).toBe(2);
  });
});
