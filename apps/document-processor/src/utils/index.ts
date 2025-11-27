// Re-export all utility functions
export { extractMetadata } from './metadata';
export { hashContent } from './hash';
export { getOrCreateCompany } from './company';
export { insertIntoVectorize } from './vectorize';
export { insertIntoD1, getOrCreateTag, getOrCreateTags } from './database';
export { convertStateToStatus } from './status';
export { syncProcessedChunks } from './progress';
export {
  getDocumentState,
  saveDocumentState,
  createChunkStorage,
  createInitialDocumentState,
} from './storage';
