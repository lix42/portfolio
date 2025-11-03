-- ============================================
-- Portfolio RAG System - Initial Schema
-- Migration: 0001
-- Created: 2025-11-03
-- ============================================

-- Companies Table
-- Stores work experience information
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_time TEXT NOT NULL,  -- ISO 8601 date: "2023-01-15"
  end_time TEXT,              -- NULL for current role
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documents Table
-- Stores metadata for documents in R2
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_hash TEXT NOT NULL UNIQUE,
  company_id INTEGER NOT NULL,
  project TEXT NOT NULL UNIQUE,
  tags TEXT NOT NULL,             -- JSON array: ["tag1", "tag2"]
  r2_key TEXT NOT NULL,           -- R2 object key
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Chunks Table
-- Stores document chunks with their content
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,          -- Full chunk text
  document_id INTEGER NOT NULL,
  type TEXT NOT NULL,             -- 'markdown', 'json', etc.
  tags TEXT NOT NULL,             -- JSON array: ["tag1", "tag2"]
  vectorize_id TEXT NOT NULL UNIQUE,  -- Links to Vectorize
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- ============================================
-- Indexes for Query Performance
-- ============================================

-- Chunks indexes
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tags ON chunks(tags);
CREATE INDEX IF NOT EXISTS idx_chunks_vectorize_id ON chunks(vectorize_id);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents(tags);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- ============================================
-- Verification Queries
-- ============================================

-- ============================================
-- D1 Notes
-- ============================================

-- D1 enforces foreign keys by default (cannot be disabled)
-- This is different from standard SQLite where PRAGMA foreign_keys must be set

-- List all tables
-- SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Check schema
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='companies';
