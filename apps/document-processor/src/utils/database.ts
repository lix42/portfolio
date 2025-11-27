import type { ChunkState, DocumentState } from '../types';

/**
 * Get or create tag by name (case-insensitive)
 * Returns tag ID
 */
export async function getOrCreateTag(
  name: string,
  db: D1Database
): Promise<number> {
  // Try to find existing tag (case-insensitive)
  const existing = await db
    .prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE')
    .bind(name)
    .first<{ id: number }>();

  if (existing) {
    return existing.id;
  }

  // Insert new tag (created_at and updated_at use DEFAULT values)
  const result = await db
    .prepare(
      `INSERT INTO tags (name)
       VALUES (?)
       RETURNING id`
    )
    .bind(name)
    .first<{ id: number }>();

  if (!result) {
    throw new Error(`Failed to create tag: ${name}`);
  }

  return result.id;
}

/**
 * Get or create multiple tags in batch
 * Returns Map of tag name -> tag ID
 */
export async function getOrCreateTags(
  tagNames: string[],
  db: D1Database
): Promise<Map<string, number>> {
  const tagMap = new Map<string, number>();

  if (tagNames.length === 0) {
    return tagMap;
  }

  // Deduplicate and normalize
  const uniqueTags = Array.from(new Set(tagNames.map((t) => t.toLowerCase())));

  // Find existing tags
  const placeholders = uniqueTags.map(() => '?').join(',');
  const existing = await db
    .prepare(
      `SELECT id, name FROM tags WHERE name IN (${placeholders}) COLLATE NOCASE`
    )
    .bind(...uniqueTags)
    .all<{ id: number; name: string }>();

  // Map existing tags
  existing.results?.forEach((tag) => {
    tagMap.set(tag.name.toLowerCase(), tag.id);
  });

  // Create missing tags
  const missingTags = uniqueTags.filter((name) => !tagMap.has(name));

  if (missingTags.length > 0) {
    const inserts = missingTags.map((name) =>
      db
        .prepare(
          `INSERT INTO tags (name)
           VALUES (?)
           RETURNING id, name`
        )
        .bind(name)
    );

    const results = await db.batch(inserts);

    results.forEach((result, index) => {
      const row = result.results?.[0] as
        | { id: number; name: string }
        | undefined;
      const tagName = missingTags[index];
      if (row && tagName) {
        tagMap.set(tagName, row.id);
      }
    });
  }

  return tagMap;
}

/**
 * Insert or update document and chunks in D1
 * Handles document updates by checking r2_key and replacing chunks if content changed
 */
export async function insertIntoD1(
  state: DocumentState,
  chunks: ChunkState[],
  db: D1Database,
  getOrCreateCompanyFn: (name: string, db: D1Database) => Promise<number>
): Promise<number> {
  if (!state.metadata) {
    throw new Error('Metadata missing');
  }

  // Check if document exists by r2_key
  const existing = await db
    .prepare('SELECT id, content_hash FROM documents WHERE r2_key = ?')
    .bind(state.metadata.r2Key)
    .first<{ id: number; content_hash: string }>();

  // Prepare tag data (used for both insert and update)
  const allTagNames = new Set<string>();
  if (state.documentTags) {
    state.documentTags.forEach((tag) => allTagNames.add(tag.toLowerCase()));
  }
  chunks.forEach((chunk) => {
    chunk.tags?.forEach((tag) => allTagNames.add(tag.toLowerCase()));
  });
  const tagMap = await getOrCreateTags(Array.from(allTagNames), db);
  const documentTags = JSON.stringify(Array.from(allTagNames));
  const companyId = await getOrCreateCompanyFn(state.metadata.company, db);

  let documentId: number;

  if (existing) {
    // Document exists - check if content changed
    if (existing.content_hash === state.metadata.contentHash) {
      console.log(
        `[${state.r2Key}] Document unchanged (hash: ${existing.content_hash}), skipping`
      );
      return existing.id;
    }

    // Content changed - update document and replace chunks
    console.log(
      `[${state.r2Key}] Document updated (old: ${existing.content_hash}, new: ${state.metadata.contentHash})`
    );

    documentId = existing.id;

    // Update document metadata
    await db
      .prepare(
        `UPDATE documents
         SET content_hash = ?, company_id = ?, tags = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(state.metadata.contentHash, companyId, documentTags, documentId)
      .run();

    // Delete old chunks (CASCADE will delete chunk_tags)
    await db
      .prepare('DELETE FROM chunks WHERE document_id = ?')
      .bind(documentId)
      .run();

    // Delete old document_tags
    await db
      .prepare('DELETE FROM document_tags WHERE document_id = ?')
      .bind(documentId)
      .run();
  } else {
    // New document - insert
    const documentResult = await db
      .prepare(
        `INSERT INTO documents (company_id, project, r2_key, content_hash, tags)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id`
      )
      .bind(
        companyId,
        state.metadata.project,
        state.metadata.r2Key,
        state.metadata.contentHash,
        documentTags
      )
      .first<{ id: number }>();

    if (!documentResult) {
      throw new Error('Failed to insert document');
    }

    documentId = documentResult.id;
  }

  // Insert document_tags junction records
  const documentTagIds =
    state.documentTags
      ?.map((tag) => tagMap.get(tag.toLowerCase()))
      .filter((id): id is number => id !== undefined) || [];

  if (documentTagIds.length > 0) {
    const documentTagInserts = documentTagIds.map((tagId) =>
      db
        .prepare(
          'INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)'
        )
        .bind(documentId, tagId)
    );
    await db.batch(documentTagInserts);
  }

  // Insert chunks (created_at and updated_at use DEFAULT values)
  const chunkInserts = chunks.map((chunk) => {
    const tags = chunk.tags ? JSON.stringify(chunk.tags) : '[]';
    const vectorizeId = `${state.r2Key}:${chunk.index}`;
    return db
      .prepare(
        `INSERT INTO chunks (document_id, content, type, tags, vectorize_id)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id`
      )
      .bind(documentId, chunk.text, 'markdown', tags, vectorizeId);
  });

  const chunkResults = await db.batch(chunkInserts);

  // Insert chunk_tags junction records
  const chunkTagInserts: D1PreparedStatement[] = [];

  chunks.forEach((chunk, index) => {
    const chunkResult = chunkResults[index]?.results?.[0] as
      | { id: number }
      | undefined;
    if (!chunkResult) {
      return;
    }

    const chunkId = chunkResult.id;
    const chunkTagIds =
      chunk.tags
        ?.map((tag) => tagMap.get(tag.toLowerCase()))
        .filter((id): id is number => id !== undefined) || [];

    chunkTagIds.forEach((tagId) => {
      chunkTagInserts.push(
        db
          .prepare('INSERT INTO chunk_tags (chunk_id, tag_id) VALUES (?, ?)')
          .bind(chunkId, tagId)
      );
    });
  });

  if (chunkTagInserts.length > 0) {
    await db.batch(chunkTagInserts);
  }

  const action = existing ? 'Updated' : 'Inserted';
  console.log(
    `[${state.r2Key}] ${action} document ${documentId} with ${chunks.length} chunks and ${chunkTagInserts.length} tag relationships`
  );

  return documentId;
}
