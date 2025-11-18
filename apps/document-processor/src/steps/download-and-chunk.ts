import { chunkMarkdown } from '@portfolio/shared';

import type { ProcessingChunk, StepContext } from '../types';
import { extractMetadata, hashContent } from '../utils';

/**
 * Step 1: Download from R2, extract metadata, and chunk
 */
export async function stepDownloadAndChunk(
  context: StepContext
): Promise<void> {
  console.log(`[${context.state.r2Key}] Step 1: Download and chunk`);

  // Download from R2
  const r2Object = await context.env.DOCUMENTS_BUCKET.get(context.state.r2Key);
  if (!r2Object) {
    throw new Error(`R2 object not found: ${context.state.r2Key}`);
  }

  // Get content
  const content = await r2Object.text();

  // Extract metadata from R2 custom metadata or companion .json file
  const metadata = await extractMetadata(
    context.state.r2Key,
    context.env.DOCUMENTS_BUCKET
  );

  // Calculate content hash
  const contentHash = await hashContent(content);

  // Chunk the content
  const chunks = chunkMarkdown(content);
  const processingChunks: ProcessingChunk[] = chunks.map((chunk) => ({
    index: chunk.index,
    text: chunk.content,
    tokens: chunk.tokens,
    embedding: null,
    tags: null,
    status: 'pending',
  }));

  // Update state
  context.state.metadata = {
    ...metadata,
    contentHash,
  };
  context.state.content = content;
  context.state.chunks = processingChunks;
  context.state.totalChunks = processingChunks.length;

  // Transition to next step (auto-advances based on registry)
  await context.next();
}
