import json
import os
import re
from typing import List

from openai_client import get_openai
from config import MODEL

__all__ = ["generate_tags"]


PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "../documents/prompts.json")


def _load_define_tags_prompt() -> str:
    """Load the defineTags system prompt from documents/prompts.json and return as a single string."""
    try:
        with open(PROMPTS_FILE, "r") as f:
            prompts = json.load(f)
        define_tags = prompts.get("defineTags", [])
        if isinstance(define_tags, list):
            return "\n".join(define_tags)
        if isinstance(define_tags, str):
            return define_tags
    except FileNotFoundError:
        print(f"[ERROR] Prompts file not found: {PROMPTS_FILE}")
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse JSON from {PROMPTS_FILE}: {e}")
    except Exception as e:
        print(f"[ERROR] Failed to load defineTags prompt from {PROMPTS_FILE}: {e}")
    return (
        "You are a helpful assistant that returns JSON with a 'tags' array of strings."
    )


def _sanitize_tags(raw_tags) -> list[str]:
    """Normalize and sanitize tags to lowercase snake_case strings and deduplicate while preserving order."""
    if not isinstance(raw_tags, list):
        return []

    seen = set()
    result: List[str] = []
    for item in raw_tags:
        if not isinstance(item, str):
            continue
        tag = item.strip().lower()
        tag = tag.replace("-", "_").replace(" ", "_")
        tag = re.sub(r"[^a-z0-9_]", "", tag)
        tag = re.sub(r"_+", "_", tag).strip("_")
        if not tag or tag in seen:
            continue
        seen.add(tag)
        result.append(tag)
    return result

def generate_tags(content: str) -> list[str]:
    """Call OpenAI to generate tags for the given document content using defineTags as system prompt."""
    try:
        system_prompt = _load_define_tags_prompt()
        user_prompt = (
            "Generate suitable tags for the following document content. "
            "Return ONLY a JSON object with a 'tags' array of strings.\n\n"
            f"Document content:\n{content}"
        )

        openai = get_openai()
        response = openai.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        content_str = response.choices[0].message.content if response.choices else "{}"
        try:
            data = json.loads(content_str)
        except json.JSONDecodeError:
            # Attempt to extract JSON object from any surrounding text
            match = re.search(r"\{[\s\S]*\}", content_str)
            try:
                data = json.loads(match.group(0)) if match else {"tags": []}
            except json.JSONDecodeError:
                print(
                    f"[ERROR] Could not parse extracted JSON from OpenAI response: {content_str}"
                )
                data = {"tags": []}
        tags = _sanitize_tags(data.get("tags", []))
        return tags
    except Exception as e:
        print(f"[ERROR] OpenAI tag generation failed: {e}")
        return []
