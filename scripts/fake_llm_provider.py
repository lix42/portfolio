"""
Fake/Mock implementation of the LLM service layer for unit testing.

This implementation provides deterministic responses and in-memory behavior,
making it perfect for unit testing without requiring API calls.
"""

import json
import hashlib
from typing import Dict, List, Any, Optional, Callable
from llm_provider import (
    LLMServiceProvider,
    ChatCompletionService,
    EmbeddingService, 
    ChatCompletionRequest,
    ChatCompletionResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    ResponseFormat
)


class FakeChatCompletionService(ChatCompletionService):
    """Fake implementation of chat completion service for testing."""
    
    def __init__(self):
        self._responses: Dict[str, str] = {}
        self._response_generator: Optional[Callable[[ChatCompletionRequest], str]] = None
        self._call_count = 0
        self._last_request: Optional[ChatCompletionRequest] = None
    
    def set_response(self, content: str, messages_key: str = "default"):
        """Set a predetermined response for specific message patterns."""
        self._responses[messages_key] = content
    
    def set_response_generator(self, generator: Callable[[ChatCompletionRequest], str]):
        """Set a function to generate dynamic responses based on the request."""
        self._response_generator = generator
    
    def set_tag_response(self, tags: List[str]):
        """Convenience method to set a JSON response with tags."""
        response = {"tags": tags}
        self.set_response(json.dumps(response))
    
    def create_completion(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        """Create a fake chat completion response."""
        self._call_count += 1
        self._last_request = request
        
        # Use response generator if available
        if self._response_generator:
            content = self._response_generator(request)
        else:
            # Create a key based on the user message content
            user_messages = [msg.content for msg in request.messages if msg.role == "user"]
            key = hashlib.md5("".join(user_messages).encode()).hexdigest()[:8]
            
            # Try to find a specific response or use default
            content = self._responses.get(key, self._responses.get("default", '{"tags": ["test_tag"]}'))
        
        # For JSON format, ensure response is valid JSON only if it's not intentionally invalid for testing
        # Allow some responses that contain embedded JSON for testing extraction
        skip_correction = content in ["invalid json response"] or 'Here are the tags:' in content
        if request.response_format == ResponseFormat.JSON_OBJECT and not skip_correction:
            try:
                json.loads(content)  # Validate it's valid JSON
            except json.JSONDecodeError:
                content = '{"tags": ["mock_tag"]}'
        
        return ChatCompletionResponse(
            content=content,
            model="fake-model",
            usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
        )
    
    def get_call_count(self) -> int:
        """Get the number of times create_completion was called."""
        return self._call_count
    
    def get_last_request(self) -> Optional[ChatCompletionRequest]:
        """Get the last request made to this service."""
        return self._last_request
    
    def reset(self):
        """Reset the service state for testing."""
        self._call_count = 0
        self._last_request = None
        self._responses.clear()
        self._response_generator = None


class FakeEmbeddingService(EmbeddingService):
    """Fake implementation of embedding service for testing."""
    
    def __init__(self):
        self._embeddings: Dict[str, List[float]] = {}
        self._embedding_generator: Optional[Callable[[str], List[float]]] = None
        self._call_count = 0
        self._last_request: Optional[EmbeddingRequest] = None
    
    def set_embedding(self, text: str, embedding: List[float]):
        """Set a predetermined embedding for specific text."""
        self._embeddings[text] = embedding
    
    def set_embedding_generator(self, generator: Callable[[str], List[float]]):
        """Set a function to generate embeddings based on text."""
        self._embedding_generator = generator
    
    def create_embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Create fake embeddings."""
        self._call_count += 1
        self._last_request = request
        
        embeddings = []
        for text in request.texts:
            if self._embedding_generator:
                embedding = self._embedding_generator(text)
            elif text in self._embeddings:
                embedding = self._embeddings[text]
            else:
                # Generate a deterministic but fake embedding based on text hash
                text_hash = hashlib.md5(text.encode()).hexdigest()
                # Convert hash to a 1536-dimensional embedding (same as text-embedding-3-small)
                embedding = []
                for i in range(0, 1536):
                    # Use different parts of the hash to generate float values between -1 and 1
                    hash_chunk = text_hash[(i % len(text_hash))]
                    embedding.append((int(hash_chunk, 16) - 7.5) / 7.5)
            
            embeddings.append(embedding)
        
        return EmbeddingResponse(
            embeddings=embeddings,
            model="fake-embedding-model",
            usage={"prompt_tokens": len(request.texts), "total_tokens": len(request.texts)}
        )
    
    def get_call_count(self) -> int:
        """Get the number of times create_embeddings was called."""
        return self._call_count
    
    def get_last_request(self) -> Optional[EmbeddingRequest]:
        """Get the last request made to this service."""
        return self._last_request
    
    def reset(self):
        """Reset the service state for testing."""
        self._call_count = 0
        self._last_request = None
        self._embeddings.clear()
        self._embedding_generator = None


class FakeLLMServiceProvider(LLMServiceProvider):
    """Fake LLM service provider for testing."""
    
    def __init__(self):
        self._chat_service = FakeChatCompletionService()
        self._embedding_service = FakeEmbeddingService()
    
    @property
    def chat(self) -> ChatCompletionService:
        """Get fake chat completion service."""
        return self._chat_service
    
    @property 
    def embeddings(self) -> EmbeddingService:
        """Get fake embedding service."""
        return self._embedding_service
    
    def reset_all(self):
        """Reset all services for testing."""
        self._chat_service.reset()
        self._embedding_service.reset()