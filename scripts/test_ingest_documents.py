"""
Unit tests for ingest_documents.py module.
Tests document ingestion from experiments directory.
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch, mock_open
import json
import tempfile
import shutil

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from ingest_documents import ingest_documents, _compute_content_hash
from fake_data_access import FakeDataAccessProvider
from fake_llm_provider import FakeLLMServiceProvider
from data_access import Company, Document


class TestComputeContentHash(unittest.TestCase):
    """Test the _compute_content_hash function."""

    def test_compute_hash_same_content_same_tags(self):
        """Test that same content and tags produce same hash."""
        content = "This is test content"
        tags = ["tag1", "tag2"]
        
        hash1 = _compute_content_hash(content, tags)
        hash2 = _compute_content_hash(content, tags)
        
        self.assertEqual(hash1, hash2)

    def test_compute_hash_different_content(self):
        """Test that different content produces different hash."""
        tags = ["tag1", "tag2"]
        
        hash1 = _compute_content_hash("Content 1", tags)
        hash2 = _compute_content_hash("Content 2", tags)
        
        self.assertNotEqual(hash1, hash2)

    def test_compute_hash_different_tags(self):
        """Test that different tags produce different hash."""
        content = "Same content"
        
        hash1 = _compute_content_hash(content, ["tag1"])
        hash2 = _compute_content_hash(content, ["tag2"])
        
        self.assertNotEqual(hash1, hash2)

    def test_compute_hash_tag_order_matters(self):
        """Test that tag order affects hash (due to sorting)."""
        content = "Test content"
        
        # Tags are sorted internally, so different order should produce same hash
        hash1 = _compute_content_hash(content, ["tag2", "tag1"])
        hash2 = _compute_content_hash(content, ["tag1", "tag2"])
        
        self.assertEqual(hash1, hash2)  # Should be same due to sorting

    def test_compute_hash_empty_content_empty_tags(self):
        """Test hash computation with empty content and tags."""
        hash_result = _compute_content_hash("", [])
        
        self.assertIsInstance(hash_result, str)
        self.assertEqual(len(hash_result), 64)  # SHA256 produces 64 character hex string

    def test_compute_hash_unicode_content(self):
        """Test hash computation with Unicode content."""
        content = "Unicode content: 你好世界 🚀"
        tags = ["unicode", "test"]
        
        hash_result = _compute_content_hash(content, tags)
        
        self.assertIsInstance(hash_result, str)
        self.assertEqual(len(hash_result), 64)


class TestIngestDocuments(unittest.TestCase):
    """Test the ingest_documents function."""

    def setUp(self):
        """Set up test fixtures."""
        self.fake_data_provider = FakeDataAccessProvider()
        self.fake_llm_provider = FakeLLMServiceProvider()
        
        # Clear all data
        self.fake_data_provider.clear_all()
        self.fake_llm_provider.reset_all()
        
        # Create a temporary directory structure for testing
        self.temp_dir = tempfile.mkdtemp()
        self.experiments_dir = os.path.join(self.temp_dir, "experiments")
        os.makedirs(self.experiments_dir)
        
        # Add a test company
        test_company = Company(
            name="TestCorp",
            title="Test Company",
            description="Company for testing"
        )
        self.fake_data_provider.companies.upsert_company(test_company)

    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)

    def _create_test_files(self, json_files, document_files):
        """Helper to create test JSON and document files."""
        for filename, content in json_files.items():
            with open(os.path.join(self.experiments_dir, filename), 'w') as f:
                json.dump(content, f)
        
        for filename, content in document_files.items():
            with open(os.path.join(self.experiments_dir, filename), 'w') as f:
                f.write(content)

    @patch('ingest_documents.EXPERIMENTS_DIR')
    @patch('ingest_documents.generate_tags')
    @patch('ingest_documents.ingest_chunks')
    def test_ingest_documents_success(self, mock_ingest_chunks, mock_generate_tags, mock_experiments_dir):
        """Test successful document ingestion."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        # Set up test files
        json_files = {
            "project1.json": {
                "project": "test-project-1",
                "document": "./project1.md",
                "company": "TestCorp"
            }
        }
        document_files = {
            "project1.md": "# Test Project 1\nThis is test content for project 1."
        }
        
        self._create_test_files(json_files, document_files)
        
        # Mock responses
        mock_generate_tags.return_value = ["test", "project"]
        mock_ingest_chunks.return_value = 3  # 3 chunks inserted
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "project1.json")]
            
            ingest_documents(
                use_remote=False,
                concurrency=1,
                data_provider=self.fake_data_provider
            )
        
        # Verify document was inserted
        document = self.fake_data_provider.documents.get_document_by_project("test-project-1")
        self.assertIsNotNone(document)
        self.assertEqual(document.project, "test-project-1")
        self.assertIn("Test Project 1", document.content)
        self.assertEqual(document.tags, ["test", "project"])
        
        # Verify ingest_chunks was called
        mock_ingest_chunks.assert_called_once()

    @patch('ingest_documents.EXPERIMENTS_DIR')
    def test_ingest_documents_no_files(self, mock_experiments_dir):
        """Test ingestion when no JSON files exist."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = []  # No files
            
            # Should not raise exception
            ingest_documents(
                use_remote=False,
                data_provider=self.fake_data_provider
            )

    @patch('ingest_documents.EXPERIMENTS_DIR')
    def test_ingest_documents_invalid_json(self, mock_experiments_dir):
        """Test handling of invalid JSON files."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        # Create invalid JSON file
        invalid_json_file = os.path.join(self.experiments_dir, "invalid.json")
        with open(invalid_json_file, 'w') as f:
            f.write("invalid json content")
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [invalid_json_file]
            
            # Should not crash, should skip invalid files
            ingest_documents(
                use_remote=False,
                data_provider=self.fake_data_provider
            )

    @patch('ingest_documents.EXPERIMENTS_DIR')
    def test_ingest_documents_missing_required_fields(self, mock_experiments_dir):
        """Test handling of JSON files missing required fields."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "incomplete1.json": {
                "project": "test-project",
                # Missing document and company
            },
            "incomplete2.json": {
                "document": "./test.md",
                # Missing project and company
            }
        }
        
        self._create_test_files(json_files, {})
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [
                os.path.join(self.experiments_dir, "incomplete1.json"),
                os.path.join(self.experiments_dir, "incomplete2.json")
            ]
            
            # Should not crash, should skip incomplete files
            ingest_documents(
                use_remote=False,
                data_provider=self.fake_data_provider
            )

    @patch('ingest_documents.EXPERIMENTS_DIR')
    def test_ingest_documents_missing_document_file(self, mock_experiments_dir):
        """Test handling when referenced document file doesn't exist."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "missing_doc.json": {
                "project": "missing-doc-project",
                "document": "./nonexistent.md",
                "company": "TestCorp"
            }
        }
        
        self._create_test_files(json_files, {})
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "missing_doc.json")]
            
            # Should not crash, should skip missing documents
            ingest_documents(
                use_remote=False,
                data_provider=self.fake_data_provider
            )

    @patch('ingest_documents.EXPERIMENTS_DIR')
    @patch('ingest_documents.INPUT_MAX_TOKENS', 100)  # Small limit for testing
    def test_ingest_documents_content_too_large(self, mock_experiments_dir):
        """Test handling when document content exceeds token limits."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "large_doc.json": {
                "project": "large-doc-project",
                "document": "./large.md",
                "company": "TestCorp"
            }
        }
        
        # Create very large document
        large_content = "This is a large document. " * 500  # Should exceed mocked limit
        document_files = {
            "large.md": large_content
        }
        
        self._create_test_files(json_files, document_files)
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "large_doc.json")]
            
            # Should skip documents that are too large
            ingest_documents(
                use_remote=False,
                data_provider=self.fake_data_provider
            )
        
        # Document should not be inserted
        document = self.fake_data_provider.documents.get_document_by_project("large-doc-project")
        self.assertIsNone(document)

    @patch('ingest_documents.EXPERIMENTS_DIR')
    def test_ingest_documents_empty_content(self, mock_experiments_dir):
        """Test handling of documents with empty content."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "empty_doc.json": {
                "project": "empty-doc-project",
                "document": "./empty.md",
                "company": "TestCorp"
            }
        }
        
        document_files = {
            "empty.md": ""  # Empty content
        }
        
        self._create_test_files(json_files, document_files)
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "empty_doc.json")]
            
            # Should skip empty documents
            ingest_documents(
                use_remote=False,
                data_provider=self.fake_data_provider
            )
        
        # Document should not be inserted
        document = self.fake_data_provider.documents.get_document_by_project("empty-doc-project")
        self.assertIsNone(document)

    @patch('ingest_documents.EXPERIMENTS_DIR')
    def test_ingest_documents_company_not_found(self, mock_experiments_dir):
        """Test handling when referenced company doesn't exist in database."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "no_company.json": {
                "project": "no-company-project",
                "document": "./test.md",
                "company": "NonExistentCorp"  # Company not in database
            }
        }
        
        document_files = {
            "test.md": "# Test Content\nSome test content."
        }
        
        self._create_test_files(json_files, document_files)
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "no_company.json")]
            
            with patch('ingest_documents.generate_tags') as mock_generate_tags:
                mock_generate_tags.return_value = ["test"]
                
                # Should skip documents with unknown companies
                ingest_documents(
                    use_remote=False,
                    data_provider=self.fake_data_provider
                )
        
        # Document should not be inserted
        document = self.fake_data_provider.documents.get_document_by_project("no-company-project")
        self.assertIsNone(document)

    @patch('ingest_documents.EXPERIMENTS_DIR')
    @patch('ingest_documents.generate_tags')
    @patch('ingest_documents.ingest_chunks')
    def test_ingest_documents_hash_match_skip(self, mock_ingest_chunks, mock_generate_tags, mock_experiments_dir):
        """Test that documents with matching hash are skipped."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "existing.json": {
                "project": "existing-project",
                "document": "./existing.md",
                "company": "TestCorp"
            }
        }
        
        document_files = {
            "existing.md": "# Existing Content\nThis content already exists."
        }
        
        self._create_test_files(json_files, document_files)
        
        # Mock tag generation
        mock_generate_tags.return_value = ["existing", "content"]
        
        # Pre-insert document with same content and tags
        content = "# Existing Content\nThis content already exists."
        tags = ["existing", "content"]
        content_hash = _compute_content_hash(content, tags)
        
        company_id = self.fake_data_provider.companies.get_company_id_by_name("TestCorp")
        existing_doc = Document(
            content=content,
            content_hash=content_hash,
            company_id=company_id,
            tags=tags,
            project="existing-project"
        )
        self.fake_data_provider.documents.upsert_document(existing_doc)
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "existing.json")]
            
            ingest_documents(
                use_remote=False,
                data_provider=self.fake_data_provider
            )
        
        # Should not call ingest_chunks since document was skipped
        mock_ingest_chunks.assert_not_called()

    @patch('ingest_documents.EXPERIMENTS_DIR')
    @patch('ingest_documents.generate_tags')
    def test_ingest_documents_tag_generation_failure(self, mock_generate_tags, mock_experiments_dir):
        """Test handling when tag generation fails."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "tag_fail.json": {
                "project": "tag-fail-project",
                "document": "./tag_fail.md",
                "company": "TestCorp"
            }
        }
        
        document_files = {
            "tag_fail.md": "# Test Content\nContent for tag generation test."
        }
        
        self._create_test_files(json_files, document_files)
        
        # Make tag generation fail
        mock_generate_tags.side_effect = Exception("Tag generation failed")
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "tag_fail.json")]
            
            with patch('ingest_documents.ingest_chunks') as mock_ingest_chunks:
                mock_ingest_chunks.return_value = 2
                
                # Should not crash, should continue with empty tags
                ingest_documents(
                    use_remote=False,
                    concurrency=1,
                    data_provider=self.fake_data_provider
                )
        
        # Document should still be inserted with empty tags
        document = self.fake_data_provider.documents.get_document_by_project("tag-fail-project")
        self.assertIsNotNone(document)
        self.assertEqual(document.tags, [])

    @patch('ingest_documents.EXPERIMENTS_DIR')
    @patch('ingest_documents.generate_tags')
    def test_ingest_documents_upsert_failure(self, mock_generate_tags, mock_experiments_dir):
        """Test handling when document upsert fails."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        json_files = {
            "upsert_fail.json": {
                "project": "upsert-fail-project",
                "document": "./upsert_fail.md",
                "company": "TestCorp"
            }
        }
        
        document_files = {
            "upsert_fail.md": "# Test Content\nContent for upsert failure test."
        }
        
        self._create_test_files(json_files, document_files)
        
        mock_generate_tags.return_value = ["test", "content"]
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [os.path.join(self.experiments_dir, "upsert_fail.json")]
            
            with patch.object(self.fake_data_provider.documents, 'upsert_document',
                            side_effect=Exception("Database error")):
                # Should not crash, should skip failed documents
                ingest_documents(
                    use_remote=False,
                    data_provider=self.fake_data_provider
                )

    @patch('ingest_documents.EXPERIMENTS_DIR')
    @patch('ingest_documents.generate_tags')
    @patch('ingest_documents.ingest_chunks')
    def test_ingest_documents_concurrency(self, mock_ingest_chunks, mock_generate_tags, mock_experiments_dir):
        """Test concurrent processing of multiple documents."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        # Create multiple test files
        json_files = {}
        document_files = {}
        
        for i in range(5):
            json_files[f"project{i}.json"] = {
                "project": f"test-project-{i}",
                "document": f"./project{i}.md",
                "company": "TestCorp"
            }
            document_files[f"project{i}.md"] = f"# Project {i}\nContent for project {i}."
        
        self._create_test_files(json_files, document_files)
        
        mock_generate_tags.return_value = ["test", "project"]
        mock_ingest_chunks.return_value = 2
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = [
                os.path.join(self.experiments_dir, f"project{i}.json") 
                for i in range(5)
            ]
            
            ingest_documents(
                use_remote=False,
                concurrency=3,  # Use 3 concurrent workers
                data_provider=self.fake_data_provider
            )
        
        # All documents should be processed
        for i in range(5):
            document = self.fake_data_provider.documents.get_document_by_project(f"test-project-{i}")
            self.assertIsNotNone(document, f"Document {i} should exist")

    @patch('ingest_documents.EXPERIMENTS_DIR')
    def test_ingest_documents_with_default_provider(self, mock_experiments_dir):
        """Test ingestion with default Supabase provider."""
        mock_experiments_dir.__str__ = lambda: self.experiments_dir
        mock_experiments_dir.__add__ = lambda self, other: self.experiments_dir + other
        
        with patch('glob.glob') as mock_glob:
            mock_glob.return_value = []  # No files to process
            
            with patch('ingest_documents.get_supabase_client') as mock_supabase_client:
                with patch('ingest_documents.SupabaseDataAccessProvider') as mock_provider:
                    mock_client = Mock()
                    mock_supabase_client.return_value = mock_client
                    
                    ingest_documents(use_remote=True)  # No data_provider specified
                    
                    # Verify Supabase client was created
                    mock_supabase_client.assert_called_once_with(use_remote=True)
                    mock_provider.assert_called_once_with(mock_client)


if __name__ == '__main__':
    unittest.main()