from openai_client import get_openai


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embeds a list of texts into vectors using OpenAI Embeddings API.
    """
    openai = get_openai()
    response = openai.embeddings.create(input=texts, model="text-embedding-3-small")
    print(response.usage)
    return [data.embedding for data in response.data]
