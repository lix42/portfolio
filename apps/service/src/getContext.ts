import { SupabaseClient } from "@supabase/supabase-js";
import {
  getChunksByEmbedding,
  getChunksByTags,
  getDocumentById,
} from "./query";

export const getContext = async (
  embedding: number[],
  tags: string[],
  supabaseClient: SupabaseClient
) => {
  const [embeddingChunksResponse, tagsChunksResponse] = await Promise.all([
    getChunksByEmbedding(embedding, supabaseClient),
    getChunksByTags(tags, supabaseClient),
  ]);

  const chunkMap: Record<string, { content: string; document_id: string }> = {};
  const chunksPoints: { [chunkId: string]: number } = {};
  const documentPoints: { [documentId: string]: number } = {};
  let topChunk: string = "";
  let topChunkPoint: number = 0;
  let topDocumentId: string = "";
  let topDocumentPoint: number = 0;
  embeddingChunksResponse.data.forEach(
    (
      chunk: Readonly<{
        id: string;
        content: string;
        similarity: number;
        document_id: string;
      }>
    ) => {
      chunkMap[chunk.id] ??= {
        content: chunk.content,
        document_id: chunk.document_id,
      };
      const chunkPoint = (chunksPoints[chunk.id] ?? 0) + chunk.similarity * 10;
      chunksPoints[chunk.id] = chunkPoint;
      if (chunkPoint > topChunkPoint) {
        topChunk = chunk.content;
        topChunkPoint = chunkPoint;
      }
      const documentPoint =
        (documentPoints[chunk.document_id] ?? 0) + chunk.similarity * 10;
      documentPoints[chunk.document_id] = documentPoint;
      if (documentPoint > topDocumentPoint) {
        topDocumentId = chunk.document_id;
        topDocumentPoint = documentPoint;
      }
    }
  );
  tagsChunksResponse.data.forEach(
    (
      chunk: Readonly<{
        id: string;
        content: string;
        matched_tags: string[];
        document_id: string;
      }>
    ) => {
      chunkMap[chunk.id] ??= {
        content: chunk.content,
        document_id: chunk.document_id,
      };
      const chunkPoint =
        (chunksPoints[chunk.id] ?? 0) + chunk.matched_tags.length;
      chunksPoints[chunk.id] = chunkPoint;
      if (chunkPoint > topChunkPoint) {
        topChunk = chunk.content;
        topChunkPoint = chunkPoint;
      }
      const documentPoint =
        (documentPoints[chunk.document_id] ?? 0) + chunk.matched_tags.length;
      documentPoints[chunk.document_id] = documentPoint;
      if (documentPoint > topDocumentPoint) {
        topDocumentId = chunk.document_id;
        topDocumentPoint = documentPoint;
      }
    }
  );
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
