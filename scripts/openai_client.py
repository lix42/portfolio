import os
from dotenv import load_dotenv
import openai


def get_openai():
    """
    Returns an OpenAI client using the API key from .env (OPENAI_API_KEY).
    Raises an error if the key is missing.
    """
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    print(f"Connecting to OpenAI with key: {api_key}")
    if not api_key:
        raise ValueError("Missing OPENAI_API_KEY in .env file.")
    openai.api_key = api_key
    return openai
