import type { ChunkState, DocumentState } from '../types';

/**
 * Insert document and chunks into D1 (transactional)
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

  // Check if document already exists (by content hash)
  const existing = await db
    .prepare('SELECT id FROM documents WHERE content_hash = ?')
    .bind(state.metadata.contentHash)
    .first<{ id: number }>();

  if (existing) {
    console.log(
      `[${state.r2Key}] Document already exists with ID ${existing.id}, skipping D1 insert`
    );
    return existing.id;
  }

  // Get or create company
  const companyId = await getOrCreateCompanyFn(state.metadata.company, db);

  // Collect all document tags from chunks
  const allTags = new Set<string>();
  if (state.documentTags) {
    state.documentTags.forEach((tag) => allTags.add(tag));
  }
  chunks.forEach((chunk) => {
    chunk.tags?.forEach((tag) => allTags.add(tag));
  });
  const documentTags = JSON.stringify(Array.from(allTags));

  // Insert document
  const documentResult = await db
    .prepare(
      `INSERT INTO documents (company_id, project, r2_key, content_hash, tags, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
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

  const documentId = documentResult.id;

  // Insert chunks (batch insert)
  const chunkInserts = chunks.map((chunk) => {
    const tags = chunk.tags ? JSON.stringify(chunk.tags) : '[]';
    const vectorizeId = `${state.r2Key}:${chunk.index}`;
    return db
      .prepare(
        `INSERT INTO chunks (document_id, content, type, tags, vectorize_id, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(documentId, chunk.text, 'markdown', tags, vectorizeId);
  });

  // Execute all inserts in a batch
  await db.batch(chunkInserts);

  console.log(
    `[${state.r2Key}] Inserted document ${documentId} with ${chunks.length} chunks into D1`
  );

  return documentId;
}
