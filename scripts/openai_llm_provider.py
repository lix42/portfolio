"""
OpenAI implementation of the LLM service layer.

This module provides concrete implementations of the LLM service interfaces
using the OpenAI API client.
"""

from openai_client import get_openai
from config import MODEL, EMBEDDING_MODEL
from llm_provider import (
    LLMServiceProvider,
    ChatCompletionService,
    EmbeddingService,
    ChatCompletionRequest,
    ChatCompletionResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    ResponseFormat,
)


class OpenAIChatCompletionService(ChatCompletionService):
    """OpenAI implementation of chat completion service."""

    def __init__(self):
        self._client = get_openai()

    def create_completion(
        self, request: ChatCompletionRequest
    ) -> ChatCompletionResponse:
        """Create a chat completion using OpenAI API."""
        client = self._client

        # Convert our message format to OpenAI format
        openai_messages = [
            {"role": msg.role, "content": msg.content} for msg in request.messages
        ]

        # Prepare API call parameters
        api_params = {
            "model": MODEL,
            "messages": openai_messages,
            "temperature": 0.2,  # Hardcoded for consistent results
        }

        # Add response format if specified
        if request.response_format == ResponseFormat.JSON_OBJECT:
            api_params["response_format"] = {"type": "json_object"}

        # Make the API call
        try:
            response = client.chat.completions.create(**api_params)

            content = response.choices[0].message.content if response.choices else ""
            usage = response.usage.model_dump() if response.usage else None

            return ChatCompletionResponse(
                content=content, model=response.model, usage=usage
            )
        except Exception as e:
            raise RuntimeError(f"OpenAI chat completion failed: {e}") from e


class OpenAIEmbeddingService(EmbeddingService):
    """OpenAI implementation of embedding service."""

    def __init__(self):
        self._client = get_openai()

    def create_embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Generate embeddings using OpenAI API."""
        client = self._client

        try:
            response = client.embeddings.create(
                input=request.texts, model=EMBEDDING_MODEL
            )

            embeddings = [data.embedding for data in response.data]
            usage = response.usage.model_dump() if response.usage else None

            return EmbeddingResponse(
                embeddings=embeddings, model=response.model, usage=usage
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
