import {
  describe,
  expect,
  test,
  vi,
  beforeEach,
  afterEach,
  MockedFunction,
} from "vitest";
import { SupabaseClient, PostgrestResponse } from "@supabase/supabase-js";
import { getContext } from "./getContext";
import * as queryModule from "./query";

// Mock the query module
vi.mock("./query", () => ({
  getChunksByEmbedding: vi.fn(),
  getChunksByTags: vi.fn(),
  getDocumentById: vi.fn(),
}));

describe("getContext", () => {
  let mockSupabaseClient: SupabaseClient;
  let mockGetChunksByEmbedding: MockedFunction<
    typeof queryModule.getChunksByEmbedding
  >;
  let mockGetChunksByTags: MockedFunction<typeof queryModule.getChunksByTags>;
  let mockGetDocumentById: MockedFunction<typeof queryModule.getDocumentById>;

  // Helper function to create proper Supabase response structure
  const createMockResponse = <T>(data: T[]) =>
    ({
      data,
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    } satisfies PostgrestResponse<T>);

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock Supabase client
    mockSupabaseClient = {} as SupabaseClient;

    // Get mocked functions
    mockGetChunksByEmbedding = vi.mocked(queryModule.getChunksByEmbedding);
    mockGetChunksByTags = vi.mocked(queryModule.getChunksByTags);
    mockGetDocumentById = vi.mocked(queryModule.getDocumentById);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("successfully processes both embedding and tags chunks and returns context", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags = ["javascript", "react"];

    const embeddingChunks = [
      {
        id: "chunk1",
        content: "React is a JavaScript library",
        similarity: 0.8,
        document_id: "doc1",
      },
      {
        id: "chunk2",
        content: "JavaScript fundamentals",
        similarity: 0.6,
        document_id: "doc1",
      },
    ];

    const tagsChunks = [
      {
        id: "chunk3",
        content: "Advanced React patterns",
        matched_tags: ["javascript", "react"],
        document_id: "doc2",
      },
      {
        id: "chunk1", // Same chunk ID as embedding chunk
        content: "React is a JavaScript library",
        matched_tags: ["react"],
        document_id: "doc1",
      },
    ];

    const documentContent = "Full document content for doc1";

    mockGetChunksByEmbedding.mockResolvedValue(
      createMockResponse(embeddingChunks)
    );
    mockGetChunksByTags.mockResolvedValue(createMockResponse(tagsChunks));

    mockGetDocumentById.mockResolvedValue(documentContent);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    expect(mockGetChunksByEmbedding).toHaveBeenCalledWith(
      embedding,
      mockSupabaseClient
    );
    expect(mockGetChunksByTags).toHaveBeenCalledWith(tags, mockSupabaseClient);
    expect(mockGetDocumentById).toHaveBeenCalledWith(
      "doc1",
      mockSupabaseClient
    );

    expect(result.topChunks).toEqual([
      "React is a JavaScript library",
      "JavaScript fundamentals",
    ]);
    expect(result.topDocumentContent).toBe(documentContent);
  });

  test("handles only embedding chunks (no tags)", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags: string[] = [];

    const embeddingChunks = [
      {
        id: "chunk1",
        content: "React is a JavaScript library",
        similarity: 0.9,
        document_id: "doc1",
      },
      {
        id: "chunk2",
        content: "JavaScript fundamentals",
        similarity: 0.7,
        document_id: "doc2",
      },
    ];

    const documentContent = "Full document content for doc1";

    mockGetChunksByEmbedding.mockResolvedValue(
      createMockResponse(embeddingChunks)
    );
    mockGetChunksByTags.mockResolvedValue(createMockResponse([]));

    mockGetDocumentById.mockResolvedValue(documentContent);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    expect(mockGetChunksByEmbedding).toHaveBeenCalledWith(
      embedding,
      mockSupabaseClient
    );
    expect(mockGetChunksByTags).toHaveBeenCalledWith(tags, mockSupabaseClient);
    expect(mockGetDocumentById).toHaveBeenCalledWith(
      "doc1",
      mockSupabaseClient
    );

    expect(result.topChunks).toEqual(["React is a JavaScript library"]);
    expect(result.topDocumentContent).toBe(documentContent);
  });

  test("handles only tags chunks (no embedding)", async () => {
    // Arrange
    const embedding: number[] = [];
    const tags = ["javascript", "react"];

    const tagsChunks = [
      {
        id: "chunk1",
        content: "React is a JavaScript library",
        matched_tags: ["javascript", "react"],
        document_id: "doc1",
      },
      {
        id: "chunk2",
        content: "JavaScript fundamentals",
        matched_tags: ["javascript"],
        document_id: "doc2",
      },
    ];

    const documentContent = "Full document content for doc1";

    mockGetChunksByEmbedding.mockResolvedValue(createMockResponse([]));
    mockGetChunksByTags.mockResolvedValue(createMockResponse(tagsChunks));

    mockGetDocumentById.mockResolvedValue(documentContent);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    expect(mockGetChunksByEmbedding).toHaveBeenCalledWith(
      embedding,
      mockSupabaseClient
    );
    expect(mockGetChunksByTags).toHaveBeenCalledWith(tags, mockSupabaseClient);
    expect(mockGetDocumentById).toHaveBeenCalledWith(
      "doc1",
      mockSupabaseClient
    );

    expect(result.topChunks).toEqual(["React is a JavaScript library"]);
    expect(result.topDocumentContent).toBe(documentContent);
  });

  test("handles empty responses from both queries", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags = ["javascript"];

    mockGetChunksByEmbedding.mockResolvedValue(createMockResponse([]));
    mockGetChunksByTags.mockResolvedValue(createMockResponse([]));

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    expect(mockGetChunksByEmbedding).toHaveBeenCalledWith(
      embedding,
      mockSupabaseClient
    );
    expect(mockGetChunksByTags).toHaveBeenCalledWith(tags, mockSupabaseClient);
    expect(mockGetDocumentById).not.toHaveBeenCalled();

    expect(result.topChunks).toEqual([""]);
    expect(result.topDocumentContent).toBeNull();
  });

  test("correctly calculates scoring for chunks and documents", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags = ["javascript"];

    const embeddingChunks = [
      {
        id: "chunk1",
        content: "React is a JavaScript library",
        similarity: 0.5, // 0.5 * 10 = 5 points
        document_id: "doc1",
      },
    ];

    const tagsChunks = [
      {
        id: "chunk1", // Same chunk, should add points
        content: "React is a JavaScript library",
        matched_tags: ["javascript", "react"], // 2 points
        document_id: "doc1",
      },
      {
        id: "chunk2",
        content: "Another chunk",
        matched_tags: ["javascript"], // 1 point
        document_id: "doc2",
      },
    ];

    const documentContent = "Full document content for doc1";

    mockGetChunksByEmbedding.mockResolvedValue(
      createMockResponse(embeddingChunks)
    );
    mockGetChunksByTags.mockResolvedValue(createMockResponse(tagsChunks));

    mockGetDocumentById.mockResolvedValue(documentContent);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    // chunk1 should have 5 (embedding) + 2 (tags) = 7 points
    // chunk2 should have 1 (tags) point
    // doc1 should have 5 (embedding) + 2 (tags) = 7 points
    // doc2 should have 1 (tags) point
    // So doc1 should be the top document
    expect(mockGetDocumentById).toHaveBeenCalledWith(
      "doc1",
      mockSupabaseClient
    );
    expect(result.topChunks).toEqual(["React is a JavaScript library"]);
    expect(result.topDocumentContent).toBe(documentContent);
  });

  test("filters chunks correctly by top document ID", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags = ["javascript"];

    const embeddingChunks = [
      {
        id: "chunk1",
        content: "Document 1 chunk 1",
        similarity: 0.9, // High similarity, should make doc1 the top document
        document_id: "doc1",
      },
      {
        id: "chunk2",
        content: "Document 2 chunk 1",
        similarity: 0.3,
        document_id: "doc2",
      },
    ];

    const tagsChunks = [
      {
        id: "chunk3",
        content: "Document 1 chunk 2",
        matched_tags: ["javascript"],
        document_id: "doc1",
      },
      {
        id: "chunk4",
        content: "Document 2 chunk 2",
        matched_tags: ["javascript"],
        document_id: "doc2",
      },
    ];

    const documentContent = "Full document content for doc1";

    mockGetChunksByEmbedding.mockResolvedValue(
      createMockResponse(embeddingChunks)
    );
    mockGetChunksByTags.mockResolvedValue(createMockResponse(tagsChunks));

    mockGetDocumentById.mockResolvedValue(documentContent);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    // doc1 should be the top document due to high similarity (0.9 * 10 = 9 points)
    // Only chunks from doc1 should be returned
    expect(mockGetDocumentById).toHaveBeenCalledWith(
      "doc1",
      mockSupabaseClient
    );
    expect(result.topChunks).toEqual([
      "Document 1 chunk 1",
      "Document 1 chunk 2",
    ]);
    expect(result.topDocumentContent).toBe(documentContent);
  });

  test("handles document retrieval returning null", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags: string[] = [];

    const embeddingChunks = [
      {
        id: "chunk1",
        content: "React is a JavaScript library",
        similarity: 0.8,
        document_id: "doc1",
      },
    ];

    mockGetChunksByEmbedding.mockResolvedValue(
      createMockResponse(embeddingChunks)
    );
    mockGetChunksByTags.mockResolvedValue(createMockResponse([]));

    mockGetDocumentById.mockResolvedValue(null);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    expect(mockGetDocumentById).toHaveBeenCalledWith(
      "doc1",
      mockSupabaseClient
    );
    expect(result.topChunks).toEqual(["React is a JavaScript library"]);
    expect(result.topDocumentContent).toBeNull();
  });

  test("handles chunks with undefined content gracefully", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags: string[] = [];

    const embeddingChunks = [
      {
        id: "chunk1",
        content: "Valid content",
        similarity: 0.8,
        document_id: "doc1",
      },
    ];

    const tagsChunks = [
      {
        id: "chunk2",
        content: undefined as any, // Simulate undefined content
        matched_tags: ["javascript"],
        document_id: "doc1",
      },
    ];

    const documentContent = "Full document content for doc1";

    mockGetChunksByEmbedding.mockResolvedValue(
      createMockResponse(embeddingChunks)
    );
    mockGetChunksByTags.mockResolvedValue(createMockResponse(tagsChunks));

    mockGetDocumentById.mockResolvedValue(documentContent);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    expect(result.topChunks).toEqual([
      "Valid content",
      "", // undefined content should be converted to empty string
    ]);
    expect(result.topDocumentContent).toBe(documentContent);
  });

  test("handles multiple chunks with same document ID correctly", async () => {
    // Arrange
    const embedding = [0.1, 0.2, 0.3];
    const tags = ["javascript"];

    const embeddingChunks = [
      {
        id: "chunk1",
        content: "First chunk from doc1",
        similarity: 0.8,
        document_id: "doc1",
      },
      {
        id: "chunk2",
        content: "Second chunk from doc1",
        similarity: 0.6,
        document_id: "doc1",
      },
    ];

    const tagsChunks = [
      {
        id: "chunk3",
        content: "Third chunk from doc1",
        matched_tags: ["javascript"],
        document_id: "doc1",
      },
    ];

    const documentContent = "Full document content for doc1";

    mockGetChunksByEmbedding.mockResolvedValue(
      createMockResponse(embeddingChunks)
    );
    mockGetChunksByTags.mockResolvedValue(createMockResponse(tagsChunks));

    mockGetDocumentById.mockResolvedValue(documentContent);

    // Act
    const result = await getContext(embedding, tags, mockSupabaseClient);

    // Assert
    expect(result.topChunks).toEqual([
      "First chunk from doc1",
      "Second chunk from doc1",
      "Third chunk from doc1",
    ]);
    expect(result.topDocumentContent).toBe(documentContent);
  });
});
