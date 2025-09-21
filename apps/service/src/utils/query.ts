import { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBEDDING_MATCH_THRESHOLD,
  EMBEDDING_MATCH_COUNT,
  TAG_MATCH_COUNT,
} from "./const";

// Perform semantic search against the knowledge base using the generated embedding
// The match_chunks_by_embedding RPC function finds the most similar content chunks
export const getChunksByEmbedding = (
  embedding: number[],
  supabaseClient: SupabaseClient
) =>
  supabaseClient.rpc("match_chunks_by_embedding", {
    query_embedding: embedding, // Vector embedding to compare against stored chunks
    match_threshold: EMBEDDING_MATCH_THRESHOLD,
    match_count: EMBEDDING_MATCH_COUNT,
  });

export const getChunksByTags = (
  tags: string[],
  supabaseClient: SupabaseClient
) =>
  supabaseClient.rpc("match_chunks_by_tags", {
    input_tags: tags,
    top_k: TAG_MATCH_COUNT,
  });

export const getDocumentById = async (
  documentId: string,
  supabaseClient: SupabaseClient
) => {
  const { data, error } = await supabaseClient
    .from("documents")
    .select("content")
    .eq("id", documentId)
    .single();
  if (!error && data) {
    return data.content;
  }
  return null;
};
