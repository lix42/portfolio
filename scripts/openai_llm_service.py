"""
OpenAI implementation of the LLM service layer.

This module provides concrete implementations of the LLM service interfaces
using the OpenAI API client.
"""

from typing import Dict, Any
from openai_client import get_openai
from llm_service import (
    LLMServiceProvider,
    ChatCompletionService, 
    EmbeddingService,
    ChatCompletionRequest,
    ChatCompletionResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    ResponseFormat
)


class OpenAIChatCompletionService(ChatCompletionService):
    """OpenAI implementation of chat completion service."""
    
    def __init__(self):
        self._client = None
    
    def _get_client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            self._client = get_openai()
        return self._client
    
    def create_completion(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        """Create a chat completion using OpenAI API."""
        client = self._get_client()
        
        # Convert our message format to OpenAI format
        openai_messages = [
            {"role": msg.role, "content": msg.content} 
            for msg in request.messages
        ]
        
        # Prepare API call parameters
        api_params = {
            "model": request.model,
            "messages": openai_messages,
            "temperature": request.temperature,
        }
        
        # Add response format if specified
        if request.response_format == ResponseFormat.JSON_OBJECT:
            api_params["response_format"] = {"type": "json_object"}
        
        # Make the API call
        try:
            response = client.chat.completions.create(**api_params)
            
            content = response.choices[0].message.content if response.choices else ""
            usage = response.usage._asdict() if hasattr(response.usage, '_asdict') else None
            
            return ChatCompletionResponse(
                content=content,
                model=response.model,
                usage=usage
            )
        except Exception as e:
            raise RuntimeError(f"OpenAI chat completion failed: {e}") from e


class OpenAIEmbeddingService(EmbeddingService):
    """OpenAI implementation of embedding service."""
    
    def __init__(self):
        self._client = None
    
    def _get_client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            self._client = get_openai()
        return self._client
    
    def create_embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Generate embeddings using OpenAI API."""
        client = self._get_client()
        
        try:
            response = client.embeddings.create(
                input=request.texts,
                model=request.model
            )
            
            embeddings = [data.embedding for data in response.data]
            usage = response.usage._asdict() if hasattr(response.usage, '_asdict') else None
            
            return EmbeddingResponse(
                embeddings=embeddings,
                model=response.model,
                usage=usage
            )
        except Exception as e:
            raise RuntimeError(f"OpenAI embedding generation failed: {e}") from e


class OpenAIServiceProvider(LLMServiceProvider):
    """OpenAI implementation of LLM service provider."""
    
    def __init__(self):
        self._chat_service = OpenAIChatCompletionService()
        self._embedding_service = OpenAIEmbeddingService()
    
    @property
    def chat(self) -> ChatCompletionService:
        """Get OpenAI chat completion service."""
        return self._chat_service
    
    @property
    def embeddings(self) -> EmbeddingService:
        """Get OpenAI embedding service."""
        return self._embedding_service