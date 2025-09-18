import { SupabaseClient } from "@supabase/supabase-js";
import {
  getChunksByEmbedding,
  getChunksByTags,
  getDocumentById,
} from "./query";
import { EMBEDDING_SCORE_WEIGHT } from "./const";

  type Chunk = Readonly<{
    id: string;
    content: string;
    document_id: string;
  }>;


  export const getContext = async (
    embedding: number[],
    tags: string[],
    supabaseClient: SupabaseClient
  ) => {
    const [embeddingChunksResponse, tagsChunksResponse] = await Promise.all([
      getChunksByEmbedding(embedding, supabaseClient),
      getChunksByTags(tags, supabaseClient),
    ]);

    const chunkMap: Record<string, { content: string; document_id: string }> =
      {};
    const chunksPoints: { [chunkId: string]: number } = {};
    const documentPoints: { [documentId: string]: number } = {};
    let topChunk: string = "";
    let topChunkPoint: number = 0;
    let topDocumentId: string = "";
    let topDocumentPoint: number = 0;

    const calculatePoint =
      <T extends Chunk>(getPoint: (chunk: T) => number) =>
      (chunk: T) => {
        chunkMap[chunk.id] ??= {
          content: chunk.content,
          document_id: chunk.document_id,
        };
        const chunkPoint = (chunksPoints[chunk.id] ?? 0) + getPoint(chunk);
        chunksPoints[chunk.id] = chunkPoint;
        if (chunkPoint > topChunkPoint) {
          topChunk = chunk.content;
          topChunkPoint = chunkPoint;
        }
        const documentPoint =
          (documentPoints[chunk.document_id] ?? 0) + getPoint(chunk);
        documentPoints[chunk.document_id] = documentPoint;
        if (documentPoint > topDocumentPoint) {
          topDocumentId = chunk.document_id;
          topDocumentPoint = documentPoint;
        }
      };

    (
      embeddingChunksResponse.data as Array<Chunk & { similarity: number }>
    ).forEach(
      calculatePoint((chunk) => chunk.similarity * EMBEDDING_SCORE_WEIGHT)
    );
    (
      tagsChunksResponse.data as Array<Chunk & { matched_tags: string[] }>
    ).forEach(calculatePoint((chunk) => chunk.matched_tags.length));

    let topChunks = [topChunk];

    let topDocumentContent: string | null = null;
    if (topDocumentId) {
      topDocumentContent = await getDocumentById(topDocumentId, supabaseClient);
      topChunks = Object.values(chunkMap)
        .filter((c) => c?.document_id === topDocumentId)
        .map((c) => c?.content ?? "");
    }
    return { topChunks, topDocumentContent };
  };
