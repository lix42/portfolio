"""
Unit tests for generate_tags.py module.
Tests tag generation functionality for both single and batch operations.
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch, mock_open
import json

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from generate_tags import (
    _load_define_tags_prompt,
    _sanitize_tags,
    generate_tags,
    batch_generate_tags
)
from fake_llm_provider import FakeLLMServiceProvider
from llm_provider import ChatCompletionRequest, ChatCompletionResponse, ResponseFormat


class TestLoadDefineTagsPrompt(unittest.TestCase):
    """Test the _load_define_tags_prompt function."""

    def test_load_prompt_success_list(self):
        """Test loading prompt when defineTags is a list."""
        mock_prompts = {
            "defineTags": ["Line 1", "Line 2", "Line 3"]
        }
        
        with patch('builtins.open', mock_open(read_data=json.dumps(mock_prompts))):
            result = _load_define_tags_prompt()
            
        self.assertEqual(result, "Line 1\nLine 2\nLine 3")

    def test_load_prompt_success_string(self):
        """Test loading prompt when defineTags is already a string."""
        mock_prompts = {
            "defineTags": "Single string prompt"
        }
        
        with patch('builtins.open', mock_open(read_data=json.dumps(mock_prompts))):
            result = _load_define_tags_prompt()
            
        self.assertEqual(result, "Single string prompt")

    def test_load_prompt_file_not_found(self):
        """Test handling when prompts file is not found."""
        with patch('builtins.open', side_effect=FileNotFoundError()):
            result = _load_define_tags_prompt()
            
        self.assertIn("helpful assistant", result)  # Should return default

    def test_load_prompt_json_decode_error(self):
        """Test handling when JSON is invalid."""
        with patch('builtins.open', mock_open(read_data="invalid json")):
            result = _load_define_tags_prompt()
            
        self.assertIn("helpful assistant", result)  # Should return default

    def test_load_prompt_missing_define_tags(self):
        """Test handling when defineTags key is missing."""
        mock_prompts = {
            "other_prompt": "Other content"
        }
        
        with patch('builtins.open', mock_open(read_data=json.dumps(mock_prompts))):
            result = _load_define_tags_prompt()
            
        # When key is missing, get() returns [] (empty list), join returns empty string ""
        self.assertEqual(result, "")  # Empty string, not the default


class TestSanitizeTags(unittest.TestCase):
    """Test the _sanitize_tags function."""

    def test_sanitize_normal_tags(self):
        """Test sanitizing normal tags."""
        raw_tags = ["Python", "Web Development", "API"]
        result = _sanitize_tags(raw_tags)
        expected = ["python", "web_development", "api"]
        self.assertEqual(result, expected)

    def test_sanitize_with_special_characters(self):
        """Test sanitizing tags with special characters."""
        raw_tags = ["Python-3.9", "Web@Development", "REST/API", "C++"]
        result = _sanitize_tags(raw_tags)
        expected = ["python_39", "webdevelopment", "restapi", "c"]  # Special chars are removed, not replaced with underscores
        self.assertEqual(result, expected)

    def test_sanitize_with_spaces_and_hyphens(self):
        """Test sanitizing tags with spaces and hyphens."""
        raw_tags = ["machine learning", "data-science", "natural language processing"]
        result = _sanitize_tags(raw_tags)
        expected = ["machine_learning", "data_science", "natural_language_processing"]
        self.assertEqual(result, expected)

    def test_sanitize_remove_duplicates(self):
        """Test that duplicates are removed while preserving order."""
        raw_tags = ["python", "Python", "PYTHON", "javascript", "python"]
        result = _sanitize_tags(raw_tags)
        expected = ["python", "javascript"]
        self.assertEqual(result, expected)

    def test_sanitize_empty_and_whitespace(self):
        """Test handling of empty strings and whitespace."""
        raw_tags = ["", "  ", "python", " javascript ", "", "web"]
        result = _sanitize_tags(raw_tags)
        expected = ["python", "javascript", "web"]
        self.assertEqual(result, expected)

    def test_sanitize_non_string_items(self):
        """Test handling of non-string items."""
        raw_tags = ["python", 123, None, "javascript", {"tag": "value"}, "web"]
        result = _sanitize_tags(raw_tags)
        expected = ["python", "javascript", "web"]
        self.assertEqual(result, expected)

    def test_sanitize_non_list_input(self):
        """Test handling of non-list input."""
        result = _sanitize_tags("not a list")
        self.assertEqual(result, [])
        
        result = _sanitize_tags(None)
        self.assertEqual(result, [])
        
        result = _sanitize_tags(123)
        self.assertEqual(result, [])

    def test_sanitize_consecutive_underscores(self):
        """Test that consecutive underscores are collapsed."""
        raw_tags = ["web___development", "data--science--ml", "api___design"]
        result = _sanitize_tags(raw_tags)
        expected = ["web_development", "data_science_ml", "api_design"]
        self.assertEqual(result, expected)

    def test_sanitize_leading_trailing_underscores(self):
        """Test that leading/trailing underscores are removed."""
        raw_tags = ["_python_", "__web__", "___api___"]
        result = _sanitize_tags(raw_tags)
        expected = ["python", "web", "api"]
        self.assertEqual(result, expected)


class TestGenerateTags(unittest.TestCase):
    """Test the generate_tags function."""

    def setUp(self):
        """Set up test fixtures."""
        self.fake_llm_provider = FakeLLMServiceProvider()
        self.fake_llm_provider.reset_all()

    def test_generate_tags_success(self):
        """Test successful tag generation."""
        content = "This is a document about Python web development using FastAPI."
        expected_tags = ["python", "web_development", "fastapi"]
        
        # Set up fake response
        self.fake_llm_provider.chat.set_tag_response(expected_tags)
        
        result = generate_tags(content, self.fake_llm_provider)
        
        self.assertEqual(result, expected_tags)
        self.assertEqual(self.fake_llm_provider.chat.get_call_count(), 1)

    def test_generate_tags_with_default_provider(self):
        """Test tag generation with default OpenAI provider."""
        content = "Test content"
        
        with patch('generate_tags.OpenAIServiceProvider') as mock_openai:
            mock_provider = Mock()
            mock_chat_service = Mock()
            mock_provider.chat = mock_chat_service
            mock_chat_service.create_completion.return_value = ChatCompletionResponse(
                content='{"tags": ["test", "content"]}',
                model="gpt-4"
            )
            mock_openai.return_value = mock_provider
            
            result = generate_tags(content)  # No provider specified
            
            self.assertEqual(result, ["test", "content"])
            mock_openai.assert_called_once()

    def test_generate_tags_json_parsing_error(self):
        """Test handling of JSON parsing errors."""
        content = "Test content"
        
        # Set up invalid JSON response
        self.fake_llm_provider.chat.set_response("invalid json response")
        
        result = generate_tags(content, self.fake_llm_provider)
        
        # Should return empty list on parsing error
        self.assertEqual(result, [])

    def test_generate_tags_extract_json_from_text(self):
        """Test extracting JSON from text response."""
        content = "Test content"
        
        # The fake provider will auto-correct invalid JSON to valid JSON for JSON_OBJECT format
        # So we need to set up a response generator that returns the embedded JSON
        def response_generator(request):
            return 'Here are the tags: {"tags": ["embedded", "json"]} and some more text.'
        
        self.fake_llm_provider.chat.set_response_generator(response_generator)
        
        result = generate_tags(content, self.fake_llm_provider)
        
        self.assertEqual(result, ["embedded", "json"])

    def test_generate_tags_no_tags_key(self):
        """Test handling when response has no 'tags' key."""
        content = "Test content"
        
        # Valid JSON but no 'tags' key
        self.fake_llm_provider.chat.set_response('{"other": ["data"]}')
        
        result = generate_tags(content, self.fake_llm_provider)
        
        self.assertEqual(result, [])

    def test_generate_tags_empty_content(self):
        """Test tag generation with empty content."""
        content = ""
        
        self.fake_llm_provider.chat.set_tag_response(["empty"])
        
        result = generate_tags(content, self.fake_llm_provider)
        
        self.assertEqual(result, ["empty"])

    def test_generate_tags_llm_exception(self):
        """Test handling of LLM service exceptions."""
        content = "Test content"
        
        # Make the fake service throw an exception
        self.fake_llm_provider.chat.set_response_generator(
            lambda req: (_ for _ in ()).throw(Exception("LLM error"))
        )
        
        result = generate_tags(content, self.fake_llm_provider)
        
        # Should return empty list on exception
        self.assertEqual(result, [])

    def test_generate_tags_request_format(self):
        """Test that the request is properly formatted."""
        content = "Test document about machine learning"
        
        self.fake_llm_provider.chat.set_tag_response(["machine_learning"])
        
        generate_tags(content, self.fake_llm_provider)
        
        # Check the request that was made
        last_request = self.fake_llm_provider.chat.get_last_request()
        self.assertIsNotNone(last_request)
        self.assertEqual(last_request.response_format, ResponseFormat.JSON_OBJECT)
        self.assertEqual(len(last_request.messages), 2)  # system and user
        self.assertEqual(last_request.messages[0].role, "system")
        self.assertEqual(last_request.messages[1].role, "user")
        self.assertIn(content, last_request.messages[1].content)


class TestBatchGenerateTags(unittest.TestCase):
    """Test the batch_generate_tags function."""

    def setUp(self):
        """Set up test fixtures."""
        self.fake_llm_provider = FakeLLMServiceProvider()
        self.fake_llm_provider.reset_all()

    def test_batch_generate_tags_empty_list(self):
        """Test batch generation with empty input."""
        result = batch_generate_tags([], self.fake_llm_provider)
        self.assertEqual(result, [])

    def test_batch_generate_tags_single_item(self):
        """Test batch generation with single item."""
        contents = ["Document about Python programming"]
        
        # Set up response for batch format
        response_data = {
            "results": [
                {"index": 0, "tags": ["python", "programming"]}
            ]
        }
        self.fake_llm_provider.chat.set_response(json.dumps(response_data))
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], ["python", "programming"])

    def test_batch_generate_tags_multiple_items(self):
        """Test batch generation with multiple items."""
        contents = [
            "Document about Python programming",
            "Article about web development",
            "Guide to machine learning"
        ]
        
        # Set up batch response
        response_data = {
            "results": [
                {"index": 0, "tags": ["python", "programming"]},
                {"index": 1, "tags": ["web", "development"]},
                {"index": 2, "tags": ["machine_learning", "guide"]}
            ]
        }
        self.fake_llm_provider.chat.set_response(json.dumps(response_data))
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0], ["python", "programming"])
        self.assertEqual(result[1], ["web", "development"])
        self.assertEqual(result[2], ["machine_learning", "guide"])

    def test_batch_generate_tags_with_default_provider(self):
        """Test batch generation with default provider."""
        contents = ["Test content"]
        
        with patch('generate_tags.OpenAIServiceProvider') as mock_openai:
            mock_provider = Mock()
            mock_chat_service = Mock()
            mock_provider.chat = mock_chat_service
            mock_chat_service.create_completion.return_value = ChatCompletionResponse(
                content='{"results": [{"index": 0, "tags": ["test"]}]}',
                model="gpt-4"
            )
            mock_openai.return_value = mock_provider
            
            result = batch_generate_tags(contents)  # No provider specified
            
            self.assertEqual(result, [["test"]])

    def test_batch_generate_tags_array_format_response(self):
        """Test handling of array format response (fallback)."""
        contents = ["Doc 1", "Doc 2"]
        
        # Response as array instead of object format
        response_data = {
            "results": [["tag1", "tag2"], ["tag3", "tag4"]]
        }
        self.fake_llm_provider.chat.set_response(json.dumps(response_data))
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0], ["tag1", "tag2"])
        self.assertEqual(result[1], ["tag3", "tag4"])

    def test_batch_generate_tags_missing_indices(self):
        """Test handling when some indices are missing from response."""
        contents = ["Doc 1", "Doc 2", "Doc 3"]
        
        # Response missing index 1
        response_data = {
            "results": [
                {"index": 0, "tags": ["tag1"]},
                {"index": 2, "tags": ["tag3"]}
            ]
        }
        self.fake_llm_provider.chat.set_response(json.dumps(response_data))
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0], ["tag1"])
        self.assertEqual(result[1], [])  # Missing, should be empty
        self.assertEqual(result[2], ["tag3"])

    def test_batch_generate_tags_invalid_json_response(self):
        """Test handling of invalid JSON response."""
        contents = ["Doc 1", "Doc 2"]
        
        self.fake_llm_provider.chat.set_response("invalid json")
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        # Should return empty lists for all inputs
        self.assertEqual(result, [[], []])

    def test_batch_generate_tags_llm_exception(self):
        """Test handling of LLM service exceptions."""
        contents = ["Doc 1", "Doc 2"]
        
        # Make the service throw an exception
        self.fake_llm_provider.chat.set_response_generator(
            lambda req: (_ for _ in ()).throw(Exception("Batch LLM error"))
        )
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        # Should return empty lists for all inputs
        self.assertEqual(result, [[], []])

    @patch('generate_tags.INPUT_MAX_TOKENS', 100)  # Small token limit for testing
    def test_batch_generate_tags_item_too_large(self):
        """Test handling when individual items exceed token limits."""
        # Create content that's too large
        large_content = "word " * 200  # Should exceed mocked limit
        contents = ["normal content", large_content, "another normal"]
        
        # Set up response for the processable items only
        response_data = {
            "results": [
                {"index": 0, "tags": ["normal"]},
                {"index": 2, "tags": ["another"]}
            ]
        }
        self.fake_llm_provider.chat.set_response(json.dumps(response_data))
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0], ["normal"])
        self.assertEqual(result[1], [])  # Too large, should be empty
        self.assertEqual(result[2], ["another"])

    def test_batch_generate_tags_batching_behavior(self):
        """Test that large inputs are properly batched."""
        # Create many small contents to test batching
        contents = [f"Document {i} content" for i in range(10)]
        
        # Set up response generator to handle multiple batches
        def batch_response_generator(request):
            # Extract indices from the request
            user_content = request.messages[1].content
            indices = []
            for line in user_content.split('\n'):
                if line.startswith('index:'):
                    indices.append(int(line.split(':')[1].strip()))
            
            # Generate response for this batch
            results = [{"index": idx, "tags": [f"tag_{idx}"]} for idx in indices]
            return json.dumps({"results": results})
        
        self.fake_llm_provider.chat.set_response_generator(batch_response_generator)
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        self.assertEqual(len(result), 10)
        for i, tags in enumerate(result):
            self.assertEqual(tags, [f"tag_{i}"])

    def test_batch_generate_tags_preserves_input_order(self):
        """Test that output order matches input order."""
        contents = ["Third", "First", "Second"]
        
        # Response with mixed order
        response_data = {
            "results": [
                {"index": 1, "tags": ["first"]},
                {"index": 2, "tags": ["second"]}, 
                {"index": 0, "tags": ["third"]}
            ]
        }
        self.fake_llm_provider.chat.set_response(json.dumps(response_data))
        
        result = batch_generate_tags(contents, self.fake_llm_provider)
        
        # Should match input order
        self.assertEqual(result[0], ["third"])   # Index 0
        self.assertEqual(result[1], ["first"])   # Index 1
        self.assertEqual(result[2], ["second"])  # Index 2


if __name__ == '__main__':
    unittest.main()