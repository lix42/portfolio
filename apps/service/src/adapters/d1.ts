/**
 * D1 Database Adapter
 * Pure functions for querying D1 database
 */

export interface ChunkWithTags {
  id: number;
  content: string;
  document_id: number;
  vectorize_id: string;
  tags: string[]; // Array of tag names from junction table
  matched_tag_count?: number;
}

export interface Document {
  id: number;
  content_hash: string;
  company_id: number;
  project: string;
  r2_key: string;
  tags: string[]; // Array of tag names from junction table
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
        COUNT(ct.tag_id) as matched_tag_count,
        GROUP_CONCAT(t.name) as tags
      FROM chunks c
      JOIN chunk_tags ct ON c.id = ct.chunk_id
      JOIN tags t ON ct.tag_id = t.id
      WHERE t.name IN (${placeholders}) COLLATE NOCASE
      GROUP BY c.id
      ORDER BY matched_tag_count DESC, c.id
      LIMIT ?`
    )
    .bind(...tagNames, limit)
    .all<Omit<ChunkWithTags, 'tags'> & { tags: string }>();

  // Convert comma-separated tags to array
  return (result.results || []).map((row) => ({
    ...row,
    tags: row.tags ? row.tags.split(',') : [],
  }));
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
        c.id,
        c.content,
        c.document_id,
        c.vectorize_id,
        GROUP_CONCAT(t.name) as tags
      FROM chunks c
      LEFT JOIN chunk_tags ct ON c.id = ct.chunk_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.vectorize_id = ?
      GROUP BY c.id`
    )
    .bind(vectorizeId)
    .first<Omit<ChunkWithTags, 'tags'> & { tags: string | null }>();

  if (!result) {
    return null;
  }

  return {
    ...result,
    tags: result.tags ? result.tags.split(',') : [],
  };
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
        c.id,
        c.content,
        c.document_id,
        c.vectorize_id,
        GROUP_CONCAT(t.name) as tags
      FROM chunks c
      LEFT JOIN chunk_tags ct ON c.id = ct.chunk_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.vectorize_id IN (${placeholders})
      GROUP BY c.id`
    )
    .bind(...vectorizeIds)
    .all<Omit<ChunkWithTags, 'tags'> & { tags: string | null }>();

  const chunkMap = new Map<string, ChunkWithTags>();
  result.results?.forEach((row) => {
    chunkMap.set(row.vectorize_id, {
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
    });
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
        d.id,
        d.content_hash,
        d.company_id,
        d.project,
        d.r2_key,
        GROUP_CONCAT(t.name) as tags
      FROM documents d
      LEFT JOIN document_tags dt ON d.id = dt.document_id
      LEFT JOIN tags t ON dt.tag_id = t.id
      WHERE d.id = ?
      GROUP BY d.id`
    )
    .bind(documentId)
    .first<Omit<Document, 'tags'> & { tags: string | null }>();

  if (!result) {
    return null;
  }

  return {
    ...result,
    tags: result.tags ? result.tags.split(',') : [],
  };
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
