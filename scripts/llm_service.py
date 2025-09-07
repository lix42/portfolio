"""
LLM Service Layer for Portfolio RAG Assistant

This module provides abstract interfaces for LLM operations (chat completions and embeddings),
making the code more testable by decoupling business logic from specific LLM providers like OpenAI.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from enum import Enum


class ResponseFormat(Enum):
    """Supported response formats for LLM completions."""
    TEXT = "text"
    JSON_OBJECT = "json_object"


@dataclass
class ChatMessage:
    """Represents a chat message in a conversation."""
    role: str  # "system", "user", or "assistant"
    content: str


@dataclass
class ChatCompletionRequest:
    """Request parameters for chat completions."""
    messages: List[ChatMessage]
    model: str
    temperature: float = 0.7
    response_format: Optional[ResponseFormat] = None


@dataclass 
class ChatCompletionResponse:
    """Response from chat completion."""
    content: str
    model: str
    usage: Optional[Dict[str, Any]] = None


@dataclass
class EmbeddingRequest:
    """Request parameters for text embeddings."""
    texts: List[str]
    model: str = "text-embedding-3-small"


@dataclass
class EmbeddingResponse:
    """Response from embedding generation."""
    embeddings: List[List[float]]
    model: str
    usage: Optional[Dict[str, Any]] = None


class ChatCompletionService(ABC):
    """Abstract service for chat completions."""
    
    @abstractmethod
    def create_completion(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        """Create a chat completion."""
        pass


class EmbeddingService(ABC):
    """Abstract service for text embeddings."""
    
    @abstractmethod 
    def create_embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Generate embeddings for the given texts."""
        pass


class LLMServiceProvider(ABC):
    """Main LLM service provider that combines chat and embedding services."""
    
    @property
    @abstractmethod
    def chat(self) -> ChatCompletionService:
        """Get chat completion service."""
        pass
    
    @property
    @abstractmethod
    def embeddings(self) -> EmbeddingService:
        """Get embedding service."""
        pass