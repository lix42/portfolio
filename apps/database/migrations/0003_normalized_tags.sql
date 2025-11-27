-- ============================================
-- Portfolio RAG System - Normalized Tags Schema
-- Migration: 0003
-- Created: 2025-11-25
-- ============================================

-- ============================================
-- Tags Master Table
-- ============================================
-- Centralized tag repository for consistent tag management
-- Supports both document-level and chunk-level tagging

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- Case-insensitive uniqueness
  description TEXT,                           -- Optional tag description
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast tag name lookups
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);

-- ============================================
-- Chunk Tags Junction Table
-- ============================================
-- Many-to-many relationship between chunks and tags

CREATE TABLE IF NOT EXISTS chunk_tags (
  chunk_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (chunk_id, tag_id),
  FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Indexes for efficient tag filtering queries
CREATE INDEX IF NOT EXISTS idx_chunk_tags_tag_id ON chunk_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_chunk_tags_chunk_id ON chunk_tags(chunk_id);

-- ============================================
-- Document Tags Junction Table
-- ============================================
-- Many-to-many relationship between documents and tags
-- Enables document-level tag filtering in future

CREATE TABLE IF NOT EXISTS document_tags (
  document_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);

-- ============================================
-- Performance Indexes
-- ============================================
-- Add missing index on chunks.vectorize_id for fast lookups

CREATE INDEX IF NOT EXISTS idx_chunks_vectorize_id ON chunks(vectorize_id);

-- ============================================
-- Note: Data Re-ingestion
-- ============================================
-- No data migration needed - existing data will be cleared and re-ingested
-- through the document-processor after this migration is applied.
--
-- To re-ingest documents after migration:
-- 1. Upload documents to R2 (or re-upload existing ones)
-- 2. Document processor will automatically create tags and populate junction tables

-- ============================================
-- Verification Queries
-- ============================================

-- List all unique tags with usage counts
-- SELECT
--   t.name,
--   COUNT(DISTINCT ct.chunk_id) as chunk_count,
--   COUNT(DISTINCT dt.document_id) as document_count
-- FROM tags t
-- LEFT JOIN chunk_tags ct ON t.id = ct.tag_id
-- LEFT JOIN document_tags dt ON t.id = dt.tag_id
-- GROUP BY t.id
-- ORDER BY chunk_count DESC;

-- Find chunks by tags (example)
-- SELECT DISTINCT
--   c.id,
--   c.content,
--   c.vectorize_id,
--   COUNT(ct.tag_id) as matched_tag_count
-- FROM chunks c
-- JOIN chunk_tags ct ON c.id = ct.chunk_id
-- JOIN tags t ON ct.tag_id = t.id
-- WHERE t.name IN ('react', 'typescript', 'performance')
-- GROUP BY c.id
-- ORDER BY matched_tag_count DESC
-- LIMIT 20;
