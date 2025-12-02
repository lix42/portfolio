import {
  getChunkByVectorizeId,
  getChunksByTags,
  getDocumentById,
  queryByEmbedding,
} from './adapters';
import { getDocumentContent } from './adapters/r2';
import { EMBEDDING_SCORE_WEIGHT } from './utils/const';

interface ScoredChunk {
  content: string;
  document_id: number;
  score: number;
  vectorize_id: string;
}

/**
 * Find the document with the highest total score
 */
function findTopDocument(chunkScores: Map<string, ScoredChunk>): number {
  const documentScores = new Map<number, number>();

  for (const chunk of chunkScores.values()) {
    const currentScore = documentScores.get(chunk.document_id) || 0;
    documentScores.set(chunk.document_id, currentScore + chunk.score);
  }

  let topDocumentId = 0;
  let topDocumentScore = 0;

  for (const [docId, score] of documentScores.entries()) {
    if (score > topDocumentScore) {
      topDocumentId = docId;
      topDocumentScore = score;
    }
  }

  return topDocumentId;
}

/**
 * Hybrid context retrieval using D1 and Vectorize
 *
 * Strategy:
 * 1. Query D1 for chunks matching tags (indexed lookup)
 * 2. Query Vectorize for semantically similar chunks
 * 3. Combine results with weighted scoring
 * 4. Return top chunks and optionally full document
 */
export const getContext = async (
  embedding: readonly number[],
  tags: readonly string[],
  env: CloudflareBindings
): Promise<{ topChunks: string[]; topDocumentContent: string | null }> => {
  // Execute queries in parallel
  const [vectorMatches, tagChunks] = await Promise.all([
    queryByEmbedding(embedding, env.VECTORIZE, 10),
    getChunksByTags(tags, env.DB, 20),
  ]);

  // Score and combine results
  const chunkScores = new Map<string, ScoredChunk>();

  // Add scores from vector similarity
  for (const match of vectorMatches) {
    const chunk = await getChunkByVectorizeId(match.id, env.DB);
    if (chunk) {
      chunkScores.set(match.id, {
        content: chunk.content,
        document_id: chunk.document_id,
        vectorize_id: match.id,
        score: match.score * EMBEDDING_SCORE_WEIGHT,
      });
    }
  }

  // Add/boost scores from tag matches
  for (const chunk of tagChunks) {
    const existing = chunkScores.get(chunk.vectorize_id);
    const tagScore = chunk.matched_tag_count || 0;

    if (existing) {
      existing.score += tagScore;
    } else {
      chunkScores.set(chunk.vectorize_id, {
        content: chunk.content,
        document_id: chunk.document_id,
        vectorize_id: chunk.vectorize_id,
        score: tagScore,
      });
    }
  }

  // Sort by score and get top chunks
  const rankedChunks = Array.from(chunkScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Find document with highest score
  const topDocumentId = findTopDocument(chunkScores);

  // Fetch full document content from R2 if we have a top document
  let topDocumentContent: string | null = null;
  if (topDocumentId > 0) {
    const document = await getDocumentById(topDocumentId, env.DB);
    if (document) {
      topDocumentContent = await getDocumentContent(
        document.r2_key,
        env.DOCUMENTS
      );
    }
  }

  // Get chunks from top document
  const topChunks =
    topDocumentId > 0
      ? rankedChunks
          .filter((c) => c.document_id === topDocumentId)
          .map((c) => c.content)
      : rankedChunks.map((c) => c.content);

  return {
    topChunks:
      topChunks.length > 0 ? topChunks : [rankedChunks[0]?.content || ''],
    topDocumentContent,
  };
};
