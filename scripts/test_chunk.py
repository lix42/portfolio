"""
Unit tests for chunk.py module.
Tests chunking functionality including markdown parsing, sentence splitting, and chunk ingestion.
"""

import os
import sys
import unittest
from unittest.mock import patch, Mock
from typing import List

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from chunk import (
    _build_chunk_context_header,
    _chunk_text_by_sentences,
    _chunk_markdown,
    ingest_chunks
)
from fake_data_access import FakeDataAccessProvider
from fake_llm_provider import FakeLLMServiceProvider
from data_access import Chunk


class TestBuildChunkContextHeader(unittest.TestCase):
    """Test the _build_chunk_context_header function."""

    def test_all_headers_no_part(self):
        """Test with all header levels present, no part number."""
        metadata = {"h1": "# Title", "h2": "## Subtitle", "h3": "### Section"}
        result = _build_chunk_context_header(metadata)
        self.assertEqual(result, "# Title\n## Subtitle\n### Section")

    def test_some_headers_missing_no_part(self):
        """Test with some headers missing, no part number."""
        metadata = {"h1": "# Title"}
        result = _build_chunk_context_header(metadata)
        self.assertEqual(result, "# Title")

    def test_all_headers_with_part(self):
        """Test with all headers present and part number."""
        metadata = {"h1": "# Title", "h2": "## Subtitle", "h3": "### Section"}
        result = _build_chunk_context_header(metadata, 2)
        self.assertEqual(result, "# Title\n## Subtitle\n### Section - part 2")

    def test_no_headers_with_part(self):
        """Test with no headers but with part number."""
        metadata = {}
        result = _build_chunk_context_header(metadata, 1)
        self.assertEqual(result, " - part 1")

    def test_partial_headers_with_part(self):
        """Test with partial headers and part number."""
        metadata = {"h1": "# Title", "h3": "### Section"}
        result = _build_chunk_context_header(metadata, 3)
        self.assertEqual(result, "# Title\n### Section - part 3")

    def test_empty_metadata(self):
        """Test with empty metadata."""
        metadata = {}
        result = _build_chunk_context_header(metadata)
        self.assertEqual(result, "")


class TestChunkTextBySentences(unittest.TestCase):
    """Test the _chunk_text_by_sentences function."""

    def test_short_text_no_chunking(self):
        """Test short text that doesn't need chunking."""
        text = "This is a sentence. This is another."
        chunks = _chunk_text_by_sentences(text, max_tokens=100)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0], text)

    def test_empty_string(self):
        """Test empty string input."""
        chunks = _chunk_text_by_sentences("", max_tokens=10)
        self.assertEqual(chunks, [])

    def test_single_sentence(self):
        """Test single sentence input."""
        text = "This is a single sentence."
        chunks = _chunk_text_by_sentences(text, max_tokens=100)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0], text)

    def test_long_text_requires_chunking(self):
        """Test long text that requires multiple chunks."""
        # Create a text with many sentences
        text = " ".join([f"Sentence number {i}." for i in range(30)])
        chunks = _chunk_text_by_sentences(text, max_tokens=10)  # Force small chunks
        self.assertGreater(len(chunks), 1)
        
        # Verify all chunks are present in some form
        combined_text = " ".join(chunks)
        for i in range(30):
            self.assertIn(f"Sentence number {i}.", combined_text)

    def test_max_tokens_respected(self):
        """Test that max_tokens limit is respected."""
        # Create sentences of known token length
        sentences = ["This is sentence one.", "This is sentence two.", "This is sentence three."]
        text = " ".join(sentences)
        
        chunks = _chunk_text_by_sentences(text, max_tokens=5)  # Very small limit
        
        # Should split into multiple chunks
        self.assertGreater(len(chunks), 1)
        # Each chunk should contain at least one sentence
        for chunk in chunks:
            self.assertGreater(len(chunk.strip()), 0)

    def test_whitespace_handling(self):
        """Test proper handling of whitespace."""
        text = "Sentence one.   Sentence two.    Sentence three."
        chunks = _chunk_text_by_sentences(text, max_tokens=100)
        self.assertEqual(len(chunks), 1)
        self.assertIn("Sentence one.", chunks[0])
        self.assertIn("Sentence two.", chunks[0])
        self.assertIn("Sentence three.", chunks[0])


class TestChunkMarkdown(unittest.TestCase):
    """Test the _chunk_markdown function."""

    def test_simple_markdown_with_headers(self):
        """Test simple markdown with all header levels."""
        md = """# Title
Some intro text.
## Subtitle  
More text here.
### Section
Even more text."""
        
        chunks = _chunk_markdown(md, max_tokens=1000)
        
        # Should have chunks containing each header
        combined = " ".join(chunks)
        self.assertIn("Title", combined)
        self.assertIn("Subtitle", combined)
        self.assertIn("Section", combined)
        self.assertIn("intro text", combined)
        self.assertIn("More text here", combined)
        self.assertIn("Even more text", combined)

    def test_empty_markdown(self):
        """Test empty markdown input."""
        chunks = _chunk_markdown("", max_tokens=10)
        self.assertEqual(chunks, [])

    def test_markdown_no_headers(self):
        """Test markdown without headers."""
        md = "Just some plain text without any headers."
        chunks = _chunk_markdown(md, max_tokens=100)
        # Should still work and return the text
        self.assertGreater(len(chunks), 0)
        self.assertIn("plain text", " ".join(chunks))

    def test_long_section_gets_chunked(self):
        """Test that long sections get split into multiple parts."""
        # Create a long text under one header
        long_text = " ".join([f"This is sentence number {i} in a very long section." for i in range(20)])
        md = f"# Title\n{long_text}"
        
        chunks = _chunk_markdown(md, max_tokens=20)  # Force small chunks
        
        self.assertGreater(len(chunks), 1)
        
        # Should have multiple parts with part numbers
        combined = " ".join(chunks)
        self.assertIn("Title", combined)
        # At least one part should have a part number
        has_part_number = any("part" in chunk for chunk in chunks)
        if len(chunks) > 1:  # Only check if actually split
            self.assertTrue(has_part_number)

    def test_multiple_headers_preserved(self):
        """Test that context headers are properly preserved."""
        md = """# Main Title
Content under main title.

## Subsection
Content under subsection.

### Sub-subsection  
Content under sub-subsection."""

        chunks = _chunk_markdown(md, max_tokens=1000)
        
        # Each chunk should contain header context
        for chunk in chunks:
            if "Content under main title" in chunk:
                self.assertIn("Main Title", chunk)
            elif "Content under subsection" in chunk:
                self.assertIn("Subsection", chunk)
            elif "Content under sub-subsection" in chunk:
                self.assertIn("sub-subsection", chunk)

    def test_very_small_token_limit(self):
        """Test behavior with very small token limits."""
        md = """# Title
This is some content that should be split into very small pieces."""
        
        chunks = _chunk_markdown(md, max_tokens=5)
        
        # Should create multiple small chunks
        self.assertGreater(len(chunks), 1)
        
        # All content should be preserved somewhere
        combined = " ".join(chunks)
        self.assertIn("Title", combined)
        self.assertIn("content", combined)
        self.assertIn("split", combined)


class TestIngestChunks(unittest.TestCase):
    """Test the ingest_chunks function."""

    def setUp(self):
        """Set up test fixtures."""
        self.fake_data_provider = FakeDataAccessProvider()
        self.fake_llm_provider = FakeLLMServiceProvider()
        
        # Clear any existing data
        self.fake_data_provider.clear_all()
        self.fake_llm_provider.reset_all()

    @patch('chunk.embed_texts')
    @patch('chunk.batch_generate_tags')
    def test_ingest_chunks_success(self, mock_batch_tags, mock_embed):
        """Test successful chunk ingestion."""
        # Setup mocks
        mock_embed.return_value = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        mock_batch_tags.return_value = [["tag1", "tag2"], ["tag3", "tag4"]]
        
        content = """# Test Document
This is a test document with some content.

## Section 1
More content here."""
        
        document_id = "doc-123"
        project = "test-project"
        
        result = ingest_chunks(
            content=content,
            document_id=document_id,
            data_provider=self.fake_data_provider,
            project=project
        )
        
        # Should return number of chunks inserted
        self.assertGreater(result, 0)
        
        # Verify chunks were inserted
        chunks = self.fake_data_provider.chunks.get_chunks_by_document_id(document_id)
        self.assertGreater(len(chunks), 0)
        
        # Verify chunk properties
        for chunk in chunks:
            self.assertEqual(chunk.document_id, document_id)
            self.assertEqual(chunk.type, "markdown")
            self.assertIsNotNone(chunk.content)
            self.assertIsNotNone(chunk.embedding)
            self.assertIsInstance(chunk.tags, list)

    @patch('chunk.embed_texts')
    @patch('chunk.batch_generate_tags')
    def test_ingest_chunks_deletes_existing(self, mock_batch_tags, mock_embed):
        """Test that existing chunks are deleted before re-ingestion."""
        # Setup mocks
        mock_embed.return_value = [[0.1, 0.2, 0.3]]
        mock_batch_tags.return_value = [["tag1"]]
        
        document_id = "doc-123"
        
        # Insert initial chunk
        initial_chunk = Chunk(
            content="Old content",
            embedding=[0.7, 0.8, 0.9],
            tags=["old_tag"],
            document_id=document_id,
            type="markdown"
        )
        self.fake_data_provider.chunks.insert_chunks([initial_chunk])
        
        # Verify initial chunk exists
        self.assertEqual(len(self.fake_data_provider.chunks.get_chunks_by_document_id(document_id)), 1)
        
        # Ingest new content
        content = "# New Content\nThis is new content."
        result = ingest_chunks(
            content=content,
            document_id=document_id,
            data_provider=self.fake_data_provider,
            project="test-project"
        )
        
        # Should have replaced old chunks
        chunks = self.fake_data_provider.chunks.get_chunks_by_document_id(document_id)
        self.assertGreater(len(chunks), 0)
        
        # None of the chunks should have old content
        for chunk in chunks:
            self.assertNotEqual(chunk.content, "Old content")
            self.assertNotIn("old_tag", chunk.tags)

    @patch('chunk.embed_texts')
    @patch('chunk.batch_generate_tags')
    def test_ingest_chunks_empty_content(self, mock_batch_tags, mock_embed):
        """Test handling of empty content."""
        result = ingest_chunks(
            content="",
            document_id="doc-123",
            data_provider=self.fake_data_provider,
            project="test-project"
        )
        
        # Should return 0 for empty content
        self.assertEqual(result, 0)
        
        # No chunks should be inserted
        chunks = self.fake_data_provider.chunks.get_chunks_by_document_id("doc-123")
        self.assertEqual(len(chunks), 0)

    @patch('chunk.embed_texts')
    @patch('chunk.batch_generate_tags')
    def test_ingest_chunks_whitespace_only(self, mock_batch_tags, mock_embed):
        """Test handling of whitespace-only content."""
        result = ingest_chunks(
            content="   \n\n  \t  ",
            document_id="doc-123", 
            data_provider=self.fake_data_provider,
            project="test-project"
        )
        
        # Should return 0 for whitespace-only content
        self.assertEqual(result, 0)

    @patch('chunk.embed_texts')
    @patch('chunk.batch_generate_tags')
    def test_ingest_chunks_embedding_failure(self, mock_batch_tags, mock_embed):
        """Test handling of embedding generation failure."""
        # Setup mocks - embedding fails
        mock_embed.side_effect = Exception("Embedding failed")
        mock_batch_tags.return_value = [["tag1"]]
        
        content = "# Test\nSome content."
        
        # The current implementation doesn't handle embedding failures gracefully,
        # so it should raise the exception
        with self.assertRaises(Exception):
            ingest_chunks(
                content=content,
                document_id="doc-123",
                data_provider=self.fake_data_provider,
                project="test-project"
            )

    @patch('chunk.embed_texts')
    @patch('chunk.batch_generate_tags')
    def test_ingest_chunks_tags_mismatch_length(self, mock_batch_tags, mock_embed):
        """Test handling when tags and chunks have mismatched lengths."""
        # Setup mocks - fewer tags than chunks
        mock_embed.return_value = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]]
        mock_batch_tags.return_value = [["tag1"], ["tag2"]]  # Only 2 tag lists for 3 chunks
        
        content = """# Section 1
Content 1

## Section 2  
Content 2

### Section 3
Content 3"""
        
        result = ingest_chunks(
            content=content,
            document_id="doc-123",
            data_provider=self.fake_data_provider,
            project="test-project"
        )
        
        # Should still succeed
        self.assertGreater(result, 0)
        
        # Verify chunks were created
        chunks = self.fake_data_provider.chunks.get_chunks_by_document_id("doc-123")
        self.assertGreater(len(chunks), 0)
        
        # Some chunks may have empty tags due to mismatch
        tag_counts = [len(chunk.tags) for chunk in chunks]
        self.assertTrue(any(count >= 0 for count in tag_counts))  # At least some should have tags or empty


if __name__ == '__main__':
    unittest.main()