from openai_llm_provider import OpenAIServiceProvider
from llm_provider import EmbeddingRequest

__all__ = ["embed_texts"]

def embed_texts(texts: list[str], llm_provider=None) -> list[list[float]]:
    """
    Generate embeddings for a list of input texts using LLM service.

    Args:
        texts (list[str]): A list of strings to embed.
        llm_provider: Optional LLM service provider. If None, uses OpenAI.

    Returns:
        list[list[float]]: A list of embedding vectors, one for each input text.
    """
    # Use provided LLM provider or default to OpenAI
    if llm_provider is None:
        llm_provider = OpenAIServiceProvider()
    
    request = EmbeddingRequest(
        texts=texts
    )
    
    response = llm_provider.embeddings.create_embeddings(request)
    return response.embeddings
