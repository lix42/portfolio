import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as adapters from "./adapters";
import * as r2Adapter from "./adapters/r2";
import { getContext } from "./getContext";

// Mock the adapter modules
vi.mock("./adapters", () => ({
  queryByEmbedding: vi.fn(),
  getChunksByTags: vi.fn(),
  getChunksByVectorizeIds: vi.fn(),
  getDocumentById: vi.fn(),
}));

vi.mock("./adapters/r2", () => ({
  getDocumentContent: vi.fn(),
}));

describe("getContext with mocked adapters", () => {
  const mockEnv = {
    DB: {} as D1Database,
    VECTORIZE: {} as VectorizeIndex,
    DOCUMENTS: {} as R2Bucket,
  } as CloudflareBindings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should combine vector and tag results with scoring", async () => {
    // Setup mocks
    vi.mocked(adapters.queryByEmbedding).mockResolvedValue([
      {
        id: "test.md:0",
        score: 0.9,
        metadata: {
          r2Key: "test.md",
          chunkIndex: 0,
          text: "React component",
        },
      },
    ]);

    vi.mocked(adapters.getChunksByVectorizeIds).mockResolvedValue(
      new Map([
        [
          "test.md:0",
          {
            id: 1,
            content: "React component example",
            document_id: 1,
            vectorize_id: "test.md:0",
            tags: ["react"],
          },
        ],
      ]),
    );

    vi.mocked(adapters.getChunksByTags).mockResolvedValue([
      {
        id: 1,
        content: "React component example",
        document_id: 1,
        vectorize_id: "test.md:0",
        tags: ["react"],
        matched_tag_count: 1,
      },
    ]);

    vi.mocked(adapters.getDocumentById).mockResolvedValue({
      id: 1,
      content_hash: "hash123",
      company_id: 1,
      project: "test-project",
      r2_key: "test.md",
      tags: ["react"],
    });

    vi.mocked(r2Adapter.getDocumentContent).mockResolvedValue(
      "Full document content",
    );

    // Execute
    const result = await getContext([0.1, 0.2, 0.3], ["react"], mockEnv);

    // Assert
    expect(result.topChunks).toEqual(["React component example"]);
    expect(result.topDocumentContent).toBe("Full document content");
    expect(adapters.queryByEmbedding).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      mockEnv.VECTORIZE,
      10,
    );
    expect(adapters.getChunksByTags).toHaveBeenCalledWith(
      ["react"],
      mockEnv.DB,
      20,
    );
  });

  it("should handle empty tag results", async () => {
    vi.mocked(adapters.queryByEmbedding).mockResolvedValue([
      {
        id: "test.md:0",
        score: 0.8,
        metadata: {
          r2Key: "test.md",
          chunkIndex: 0,
          text: "Test content",
        },
      },
    ]);

    vi.mocked(adapters.getChunksByVectorizeIds).mockResolvedValue(
      new Map([
        [
          "test.md:0",
          {
            id: 1,
            content: "Test content",
            document_id: 1,
            vectorize_id: "test.md:0",
            tags: [],
          },
        ],
      ]),
    );

    vi.mocked(adapters.getChunksByTags).mockResolvedValue([]);

    vi.mocked(adapters.getDocumentById).mockResolvedValue({
      id: 1,
      content_hash: "hash123",
      company_id: 1,
      project: "test-project",
      r2_key: "test.md",
      tags: [],
    });

    vi.mocked(r2Adapter.getDocumentContent).mockResolvedValue(
      "Document content",
    );

    const result = await getContext([0.1, 0.2, 0.3], [], mockEnv);

    expect(result.topChunks).toEqual(["Test content"]);
    expect(result.topDocumentContent).toBe("Document content");
  });

  it("should handle empty vector results", async () => {
    vi.mocked(adapters.queryByEmbedding).mockResolvedValue([]);

    vi.mocked(adapters.getChunksByVectorizeIds).mockResolvedValue(new Map());

    vi.mocked(adapters.getChunksByTags).mockResolvedValue([
      {
        id: 1,
        content: "Tag-based result",
        document_id: 1,
        vectorize_id: "test.md:0",
        tags: ["react"],
        matched_tag_count: 1,
      },
    ]);

    vi.mocked(adapters.getDocumentById).mockResolvedValue({
      id: 1,
      content_hash: "hash123",
      company_id: 1,
      project: "test-project",
      r2_key: "test.md",
      tags: ["react"],
    });

    vi.mocked(r2Adapter.getDocumentContent).mockResolvedValue(
      "Document content",
    );

    const result = await getContext([0.1, 0.2, 0.3], ["react"], mockEnv);

    expect(result.topChunks).toEqual(["Tag-based result"]);
    expect(result.topDocumentContent).toBe("Document content");
  });

  it("should boost scores for chunks matching both vector and tags", async () => {
    const sharedChunkId = "test.md:0";

    vi.mocked(adapters.queryByEmbedding).mockResolvedValue([
      {
        id: sharedChunkId,
        score: 0.5, // 0.5 * 10 (EMBEDDING_SCORE_WEIGHT) = 5
        metadata: {
          r2Key: "test.md",
          chunkIndex: 0,
          text: "React",
        },
      },
    ]);

    vi.mocked(adapters.getChunksByVectorizeIds).mockResolvedValue(
      new Map([
        [
          sharedChunkId,
          {
            id: 1,
            content: "React hooks guide",
            document_id: 1,
            vectorize_id: sharedChunkId,
            tags: ["react"],
          },
        ],
      ]),
    );

    vi.mocked(adapters.getChunksByTags).mockResolvedValue([
      {
        id: 1,
        content: "React hooks guide",
        document_id: 1,
        vectorize_id: sharedChunkId,
        tags: ["react"],
        matched_tag_count: 2, // Tag score: 2
      },
    ]);

    vi.mocked(adapters.getDocumentById).mockResolvedValue({
      id: 1,
      content_hash: "hash123",
      company_id: 1,
      project: "test-project",
      r2_key: "test.md",
      tags: ["react"],
    });

    vi.mocked(r2Adapter.getDocumentContent).mockResolvedValue("Full content");

    const result = await getContext([0.1, 0.2], ["react"], mockEnv);

    // Should have combined score (5 from vector + 2 from tags = 7)
    expect(result.topChunks).toEqual(["React hooks guide"]);
    expect(result.topDocumentContent).toBe("Full content");
  });

  it("should return null when no results found", async () => {
    vi.mocked(adapters.queryByEmbedding).mockResolvedValue([]);
    vi.mocked(adapters.getChunksByVectorizeIds).mockResolvedValue(new Map());
    vi.mocked(adapters.getChunksByTags).mockResolvedValue([]);

    const result = await getContext([0.1, 0.2, 0.3], ["nonexistent"], mockEnv);

    expect(result.topChunks).toBeNull();
    expect(result.topDocumentContent).toBeNull();
  });

  it("should filter chunks by top document", async () => {
    vi.mocked(adapters.queryByEmbedding).mockResolvedValue([
      {
        id: "doc1.md:0",
        score: 0.9, // 9 points
        metadata: { r2Key: "doc1.md", chunkIndex: 0, text: "Doc1 chunk1" },
      },
      {
        id: "doc2.md:0",
        score: 0.3, // 3 points
        metadata: { r2Key: "doc2.md", chunkIndex: 0, text: "Doc2 chunk1" },
      },
    ]);

    vi.mocked(adapters.getChunksByVectorizeIds).mockResolvedValue(
      new Map([
        [
          "doc1.md:0",
          {
            id: 1,
            content: "Doc1 chunk1",
            document_id: 1,
            vectorize_id: "doc1.md:0",
            tags: ["react"],
          },
        ],
        [
          "doc2.md:0",
          {
            id: 3,
            content: "Doc2 chunk1",
            document_id: 2,
            vectorize_id: "doc2.md:0",
            tags: ["typescript"],
          },
        ],
      ]),
    );

    vi.mocked(adapters.getChunksByTags).mockResolvedValue([
      {
        id: 2,
        content: "Doc1 chunk2",
        document_id: 1,
        vectorize_id: "doc1.md:1",
        tags: ["react"],
        matched_tag_count: 1,
      },
    ]);

    vi.mocked(adapters.getDocumentById).mockResolvedValue({
      id: 1,
      content_hash: "hash123",
      company_id: 1,
      project: "doc1",
      r2_key: "doc1.md",
      tags: ["react"],
    });

    vi.mocked(r2Adapter.getDocumentContent).mockResolvedValue("Doc1 content");

    const result = await getContext([0.1, 0.2], ["react"], mockEnv);

    // Should only return chunks from document 1 (highest score)
    expect(result.topChunks).toEqual(["Doc1 chunk1", "Doc1 chunk2"]);
    expect(result.topDocumentContent).toBe("Doc1 content");
  });

  it("should handle null document content gracefully", async () => {
    vi.mocked(adapters.queryByEmbedding).mockResolvedValue([
      {
        id: "test.md:0",
        score: 0.8,
        metadata: { r2Key: "test.md", chunkIndex: 0, text: "Content" },
      },
    ]);

    vi.mocked(adapters.getChunksByVectorizeIds).mockResolvedValue(
      new Map([
        [
          "test.md:0",
          {
            id: 1,
            content: "Content",
            document_id: 1,
            vectorize_id: "test.md:0",
            tags: [],
          },
        ],
      ]),
    );

    vi.mocked(adapters.getChunksByTags).mockResolvedValue([]);

    vi.mocked(adapters.getDocumentById).mockResolvedValue({
      id: 1,
      content_hash: "hash123",
      company_id: 1,
      project: "test",
      r2_key: "test.md",
      tags: [],
    });

    vi.mocked(r2Adapter.getDocumentContent).mockResolvedValue(null);

    const result = await getContext([0.1, 0.2], [], mockEnv);

    expect(result.topChunks).toEqual(["Content"]);
    expect(result.topDocumentContent).toBeNull();
  });
});
