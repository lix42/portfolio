import { describe, expect, it, vi } from "vitest";

import type { ChunkState, StepContext } from "../types";
import { stepGenerateTagsBatch } from "./generate-tags";

vi.mock("@portfolio/shared", () => ({
  TAG_BATCH_SIZE: 2,
  generateTagsBatch: vi.fn(async (texts: string[]) =>
    texts.map(() => ["tagged"]),
  ),
}));

function createContext(
  initialChunks: ChunkState[],
  stateOverrides?: Partial<StepContext["state"]>,
) {
  const chunks = [...initialChunks];

  const chunkStore = {
    getChunk: async (index: number) =>
      chunks.find((chunk) => chunk.index === index),
    saveChunk: async (chunk: ChunkState) => {
      const existingIndex = chunks.findIndex((c) => c.index === chunk.index);
      if (existingIndex >= 0) {
        chunks[existingIndex] = chunk;
      } else {
        chunks.push(chunk);
      }
    },
    saveChunks: async (updated: ChunkState[]) => {
      for (const chunk of updated) {
        await chunkStore.saveChunk(chunk);
      }
    },
    getChunksByStatus: async (status: ChunkState["status"]) =>
      chunks.filter((chunk) => chunk.status === status),
    getAllChunks: async () => [...chunks],
  } satisfies StepContext["chunks"];

  const state: StepContext["state"] = {
    status: "processing",
    r2Key: "test.md",
    currentStep: "tags",
    totalChunks: chunks.length,
    processedChunks: 0,
    errors: [],
    retryCount: 0,
    ...stateOverrides,
  };

  const next = vi.fn(async () => {});

  const context: StepContext = {
    state,
    chunks: chunkStore,
    env: {
      DOCUMENTS_BUCKET: {} as R2Bucket,
      DB: {} as D1Database,
      VECTORIZE: {} as VectorizeIndex,
      OPENAI_API_KEY: "test-key",
    },
    next,
    fail: vi.fn(async () => {}),
  };

  return { context, chunks, next };
}

describe("stepGenerateTagsBatch", () => {
  it("updates processedChunks when tagging a batch", async () => {
    const initialChunks: ChunkState[] = [
      {
        index: 0,
        text: "A",
        tokens: 10,
        embedding: [],
        tags: null,
        status: "embedding_done",
      },
      {
        index: 1,
        text: "B",
        tokens: 12,
        embedding: [],
        tags: null,
        status: "embedding_done",
      },
    ];

    const { context, chunks, next } = createContext(initialChunks);

    await stepGenerateTagsBatch(context);

    expect(next).toHaveBeenCalledWith({ continueCurrentStep: true });
    expect(context.state.processedChunks).toBe(2);
    expect(chunks.every((chunk) => chunk.status === "tags_done")).toBe(true);
  });

  it("syncs processedChunks when no pending chunks remain", async () => {
    const initialChunks: ChunkState[] = [
      {
        index: 0,
        text: "Done",
        tokens: 5,
        embedding: [],
        tags: ["tagged"],
        status: "tags_done",
      },
    ];

    const { context, next } = createContext(initialChunks, {
      processedChunks: 0,
    });

    await stepGenerateTagsBatch(context);

    expect(next).toHaveBeenCalledTimes(1);
    expect(context.state.processedChunks).toBe(1);
  });
});
