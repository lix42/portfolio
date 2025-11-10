/**
 * Service-specific constants for the Portfolio Query Service
 *
 * Note: Generic constants (models, embedding dimensions, search limits, etc.)
 * have been migrated to @portfolio/shared for reuse across services.
 */

// Vector similarity threshold for semantic search
// 0.25 = 25% similarity minimum - lower values return more but less relevant results
export const EMBEDDING_MATCH_THRESHOLD = 0.25;

// Weight multiplier for embedding similarity scores in hybrid ranking
// Higher values prioritize semantic similarity over tag matches
export const EMBEDDING_SCORE_WEIGHT = 10;
