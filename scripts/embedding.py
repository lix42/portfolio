from openai_client import get_openai

def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a list of input texts using the OpenAI API.

    Args:
        texts (list[str]): A list of strings to embed.

    Returns:
        list[list[float]]: A list of embedding vectors, one for each input text.
    """
    openai = get_openai()
    response = openai.embeddings.create(input=texts, model="text-embedding-3-small")
    return [data.embedding for data in response.data]
