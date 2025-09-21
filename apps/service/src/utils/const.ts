// Vector similarity threshold for semantic search
// 0.25 = 25% similarity minimum - lower values return more but less relevant results
export const EMBEDDING_MATCH_THRESHOLD = 0.25;

// Maximum number of chunks to return from vector search
// Limits response size while providing sufficient context for RAG
export const EMBEDDING_MATCH_COUNT = 5;

// Maximum number of chunks to return from tag-based search
// Consistent limit across different search methods
export const TAG_MATCH_COUNT = 5;

// Weight multiplier for embedding similarity scores in hybrid ranking
// Higher values prioritize semantic similarity over tag matches
export const EMBEDDING_SCORE_WEIGHT = 10;
