import type { ChunkState, ChunkStorage, DocumentState } from "../types";

/**
 * Storage key constants
 */
const DOCUMENT_STATE_KEY = "state";
const CHUNK_KEY_PREFIX = "chunk:";

/**
 * Get the storage key for a chunk by index
 */
export const chunkKey = (index: number): string =>
  `${CHUNK_KEY_PREFIX}${index}`;

/**
 * Get document state from storage
 */
export async function getDocumentState(
  storage: DurableObjectStorage,
): Promise<DocumentState | undefined> {
  return storage.get<DocumentState>(DOCUMENT_STATE_KEY);
}

/**
 * Save document state to storage
 */
export async function saveDocumentState(
  storage: DurableObjectStorage,
  state: DocumentState,
): Promise<void> {
  await storage.put(DOCUMENT_STATE_KEY, state);
}

/**
 * Get a single chunk from storage
 */
export async function getChunk(
  storage: DurableObjectStorage,
  index: number,
): Promise<ChunkState | undefined> {
  return storage.get<ChunkState>(chunkKey(index));
}

/**
 * Save a single chunk to storage
 */
export async function saveChunk(
  storage: DurableObjectStorage,
  chunk: ChunkState,
): Promise<void> {
  await storage.put(chunkKey(chunk.index), chunk);
}

/**
 * Save multiple chunks to storage (batch operation)
 */
export async function saveChunks(
  storage: DurableObjectStorage,
  chunks: ChunkState[],
): Promise<void> {
  const entries: Record<string, ChunkState> = {};
  for (const chunk of chunks) {
    entries[chunkKey(chunk.index)] = chunk;
  }
  await storage.put(entries);
}

/**
 * Get all chunks with a specific status
 */
export async function getChunksByStatus(
  storage: DurableObjectStorage,
  status: ChunkState["status"],
): Promise<ChunkState[]> {
  const chunks = await getAllChunks(storage);
  return chunks.filter((chunk) => chunk.status === status);
}

/**
 * Get all chunks from storage
 */
export async function getAllChunks(
  storage: DurableObjectStorage,
): Promise<ChunkState[]> {
  const entries = await storage.list<ChunkState>({
    prefix: CHUNK_KEY_PREFIX,
  });

  const chunks: ChunkState[] = Array.from(entries.values());
  // Sort by index for consistent ordering
  return chunks.sort((a, b) => a.index - b.index);
}

/**
 * Delete all state (document + all chunks)
 */
export async function deleteAllState(
  storage: DurableObjectStorage,
): Promise<void> {
  await storage.deleteAll();
}

/**
 * Create a ChunkStorage interface bound to a specific storage instance
 */
export function createChunkStorage(
  storage: DurableObjectStorage,
): ChunkStorage {
  return {
    getChunk: (index: number) => getChunk(storage, index),
    saveChunk: (chunk: ChunkState) => saveChunk(storage, chunk),
    saveChunks: (chunks: ChunkState[]) => saveChunks(storage, chunks),
    getChunksByStatus: (status: ChunkState["status"]) =>
      getChunksByStatus(storage, status),
    getAllChunks: () => getAllChunks(storage),
  };
}

/**
 * Create initial document state
 */
export function createInitialDocumentState(r2Key: string): DocumentState {
  return {
    status: "processing",
    r2Key,
    currentStep: "download",
    totalChunks: 0,
    processedChunks: 0,
    errors: [],
    retryCount: 0,
    startedAt: new Date().toISOString(),
  };
}
