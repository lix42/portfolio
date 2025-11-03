-- ============================================
-- Test Data for Development
-- Migration: 0002
-- ============================================

-- Test Company
INSERT INTO companies (name, start_time, end_time, title, description)
VALUES (
  'Test Company Inc',
  '2023-01-01',
  '2024-12-31',
  'Senior Software Engineer',
  'Sample company for development and testing purposes'
);

-- Test Document
INSERT INTO documents (content_hash, company_id, project, tags, r2_key)
VALUES (
  'test-hash-' || hex(randomblob(16)),
  1,
  'test/sample-document',
  '["testing", "development", "sample"]',
  'documents/test/sample-document.md'
);

-- Test Chunks
INSERT INTO chunks (content, document_id, type, tags, vectorize_id)
VALUES
  (
    'This is a test chunk for validation. It demonstrates the database schema working correctly.',
    1,
    'markdown',
    '["testing", "sample"]',
    'test-doc-1-chunk-0'
  ),
  (
    'Another test chunk to verify multiple chunks per document work as expected.',
    1,
    'markdown',
    '["testing", "validation"]',
    'test-doc-1-chunk-1'
  );

-- Verification query
SELECT
  co.name as company,
  d.project,
  COUNT(ch.id) as chunk_count
FROM companies co
JOIN documents d ON d.company_id = co.id
JOIN chunks ch ON ch.document_id = d.id
GROUP BY co.id, d.id;
