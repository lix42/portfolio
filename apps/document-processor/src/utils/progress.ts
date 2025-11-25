import type { StepContext } from '../types';

/**
 * Synchronize processedChunks on the document state with the number of chunks
 * that have completed tagging or storage. Tags are the last per-chunk phase
 * before writing to external stores, so this reflects end-to-end progress
 * without double counting on retries.
 */
export async function syncProcessedChunks(context: StepContext): Promise<void> {
  const [taggedChunks, storedChunks] = await Promise.all([
    context.chunks.getChunksByStatus('tags_done'),
    context.chunks.getChunksByStatus('stored'),
  ]);

  // statuses are mutually exclusive, so a simple sum is safe
  context.state.processedChunks = taggedChunks.length + storedChunks.length;
}
