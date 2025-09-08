"""
Unit tests for embedding.py module.
Tests text embedding generation functionality.
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch

# Add scripts directory to path for imports  
sys.path.insert(0, os.path.dirname(__file__))

from embedding import embed_texts
from fake_llm_provider import FakeLLMServiceProvider
from llm_provider import EmbeddingRequest, EmbeddingResponse


class TestEmbedTexts(unittest.TestCase):
    """Test the embed_texts function."""

    def setUp(self):
        """Set up test fixtures."""
        self.fake_llm_provider = FakeLLMServiceProvider()

    def test_embed_single_text(self):
        """Test embedding a single text."""
        texts = ["This is a test sentence."]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], list)
        self.assertGreater(len(result[0]), 0)  # Should have some dimensions
        
        # Verify the LLM provider was called
        self.assertEqual(self.fake_llm_provider.embeddings.get_call_count(), 1)

    def test_embed_multiple_texts(self):
        """Test embedding multiple texts."""
        texts = [
            "First text to embed.",
            "Second text to embed.", 
            "Third text to embed."
        ]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), len(texts))
        
        # Each result should be a list of floats
        for embedding in result:
            self.assertIsInstance(embedding, list)
            self.assertGreater(len(embedding), 0)
            for value in embedding:
                self.assertIsInstance(value, (int, float))

    def test_embed_empty_list(self):
        """Test embedding an empty list of texts."""
        texts = []
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 0)

    def test_embed_empty_string(self):
        """Test embedding an empty string."""
        texts = [""]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], list)

    def test_embed_with_special_characters(self):
        """Test embedding text with special characters."""
        texts = [
            "Text with émojis 🚀 and special chars: @#$%^&*()",
            "Multi-line\ntext\nwith\nbreaks",
            "    Leading and trailing spaces    ",
            "Numbers 123 and symbols !@#$%"
        ]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertEqual(len(result), len(texts))
        for embedding in result:
            self.assertIsInstance(embedding, list)
            self.assertGreater(len(embedding), 0)

    def test_embed_very_long_text(self):
        """Test embedding very long text."""
        # Create a long text
        long_text = " ".join([f"Word number {i}" for i in range(1000)])
        texts = [long_text]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], list)
        self.assertGreater(len(result[0]), 0)

    def test_embed_with_default_provider(self):
        """Test embedding with default OpenAI provider."""
        texts = ["Test with default provider"]
        
        # Mock the OpenAI provider
        with patch('embedding.OpenAIServiceProvider') as mock_openai_provider:
            mock_provider = Mock()
            mock_embeddings_service = Mock()
            mock_provider.embeddings = mock_embeddings_service
            mock_embeddings_service.create_embeddings.return_value = EmbeddingResponse(
                embeddings=[[0.1, 0.2, 0.3]],
                model="text-embedding-3-small"
            )
            mock_openai_provider.return_value = mock_provider
            
            result = embed_texts(texts)  # No provider specified
            
            self.assertEqual(len(result), 1)
            mock_openai_provider.assert_called_once()
            mock_embeddings_service.create_embeddings.assert_called_once()

    def test_embed_request_parameters(self):
        """Test that correct parameters are passed to the LLM provider."""
        texts = ["Test text 1", "Test text 2"]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        # Check the last request made to the provider
        last_request = self.fake_llm_provider.embeddings.get_last_request()
        self.assertIsNotNone(last_request)
        self.assertEqual(last_request.texts, texts)

    def test_embed_deterministic_output(self):
        """Test that the same input produces the same output (with fake provider)."""
        texts = ["Consistent text for testing"]
        
        result1 = embed_texts(texts, self.fake_llm_provider)
        
        # Reset provider and embed again
        self.fake_llm_provider.reset_all()
        result2 = embed_texts(texts, self.fake_llm_provider)
        
        # With the fake provider, same input should give same output
        self.assertEqual(result1, result2)

    def test_embed_different_texts_different_outputs(self):
        """Test that different texts produce different embeddings."""
        text1 = ["First unique text"]
        text2 = ["Second different text"]
        
        result1 = embed_texts(text1, self.fake_llm_provider)
        result2 = embed_texts(text2, self.fake_llm_provider)
        
        # Results should be different (with high probability)
        self.assertNotEqual(result1, result2)

    def test_embed_provider_call_count(self):
        """Test that the provider is called the expected number of times."""
        texts1 = ["First batch"]
        texts2 = ["Second batch", "Additional text"]
        
        embed_texts(texts1, self.fake_llm_provider)
        embed_texts(texts2, self.fake_llm_provider)
        
        # Should be called twice
        self.assertEqual(self.fake_llm_provider.embeddings.get_call_count(), 2)

    def test_embed_unicode_text(self):
        """Test embedding Unicode text."""
        texts = [
            "Hello 世界",  # Chinese
            "Привет мир",  # Russian  
            "مرحبا بالعالم",  # Arabic
            "🌍🌎🌏"  # Emoji
        ]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertEqual(len(result), len(texts))
        for embedding in result:
            self.assertIsInstance(embedding, list)
            self.assertGreater(len(embedding), 0)

    def test_embed_mixed_content_types(self):
        """Test embedding mixed content types."""
        texts = [
            "Plain text",
            "Text with\nnewlines\nand\ttabs",
            "   Whitespace   ",
            "",  # Empty
            "Numbers: 123, 456.789",
            "Special: @#$%^&*()[]{}|\\:;\"'<>?/",
            "Mixed: Hello 世界 123 🚀"
        ]
        
        result = embed_texts(texts, self.fake_llm_provider)
        
        self.assertEqual(len(result), len(texts))
        for embedding in result:
            self.assertIsInstance(embedding, list)
            # Even empty strings should get some embedding
            self.assertGreater(len(embedding), 0)


if __name__ == '__main__':
    unittest.main()