/**
 * D1 Database Adapter
 * Pure functions for querying D1 database
 */

export interface ChunkWithTags {
  id: number;
  content: string;
  document_id: number;
  vectorize_id: string;
  tags: string; // JSON array
  matched_tag_count?: number;
}

export interface Document {
  id: number;
  content_hash: string;
  company_id: number;
  project: string;
  r2_key: string;
  tags: string; // JSON array
}

/**
 * Get chunks by tag names (with tag count scoring)
 * Returns chunks that match any of the provided tags
 */
export async function getChunksByTags(
  tagNames: readonly string[],
  db: D1Database,
  limit = 20
): Promise<ChunkWithTags[]> {
  if (tagNames.length === 0) {
    return [];
  }

  const placeholders = tagNames.map(() => '?').join(',');

  const result = await db
    .prepare(
      `SELECT
        c.id,
        c.content,
        c.document_id,
        c.vectorize_id,
        c.tags,
        COUNT(ct.tag_id) as matched_tag_count
      FROM chunks c
      JOIN chunk_tags ct ON c.id = ct.chunk_id
      JOIN tags t ON ct.tag_id = t.id
      WHERE t.name IN (${placeholders}) COLLATE NOCASE
      GROUP BY c.id
      ORDER BY matched_tag_count DESC, c.id
      LIMIT ?`
    )
    .bind(...tagNames, limit)
    .all<ChunkWithTags>();

  return result.results || [];
}

/**
 * Get chunk by vectorize_id
 * Used to fetch full chunk details after Vectorize query
 */
export async function getChunkByVectorizeId(
  vectorizeId: string,
  db: D1Database
): Promise<ChunkWithTags | null> {
  const result = await db
    .prepare(
      `SELECT
        id,
        content,
        document_id,
        vectorize_id,
        tags
      FROM chunks
      WHERE vectorize_id = ?`
    )
    .bind(vectorizeId)
    .first<ChunkWithTags>();

  return result || null;
}

/**
 * Get multiple chunks by vectorize_ids
 * Batch version for efficiency
 */
export async function getChunksByVectorizeIds(
  vectorizeIds: readonly string[],
  db: D1Database
): Promise<Map<string, ChunkWithTags>> {
  if (vectorizeIds.length === 0) {
    return new Map();
  }

  const placeholders = vectorizeIds.map(() => '?').join(',');

  const result = await db
    .prepare(
      `SELECT
        id,
        content,
        document_id,
        vectorize_id,
        tags
      FROM chunks
      WHERE vectorize_id IN (${placeholders})`
    )
    .bind(...vectorizeIds)
    .all<ChunkWithTags>();

  const chunkMap = new Map<string, ChunkWithTags>();
  result.results?.forEach((chunk) => {
    chunkMap.set(chunk.vectorize_id, chunk);
  });

  return chunkMap;
}

/**
 * Get document by ID
 * Returns document metadata (R2 key for content retrieval)
 */
export async function getDocumentById(
  documentId: number,
  db: D1Database
): Promise<Document | null> {
  const result = await db
    .prepare(
      `SELECT
        id,
        content_hash,
        company_id,
        project,
        r2_key,
        tags
      FROM documents
      WHERE id = ?`
    )
    .bind(documentId)
    .first<Document>();

  return result || null;
}

/**
 * Get all tags with usage statistics
 * Useful for tag management and analytics
 */
export async function getAllTags(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT
        t.id,
        t.name,
        COUNT(DISTINCT ct.chunk_id) as chunk_count,
        COUNT(DISTINCT dt.document_id) as document_count
      FROM tags t
      LEFT JOIN chunk_tags ct ON t.id = ct.tag_id
      LEFT JOIN document_tags dt ON t.id = dt.tag_id
      GROUP BY t.id
      ORDER BY chunk_count DESC`
    )
    .all<{
      id: number;
      name: string;
      chunk_count: number;
      document_count: number;
    }>();

  return result.results || [];
}
