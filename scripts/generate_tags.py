import json
import os
import re
import tiktoken

from config import MODEL, INPUT_MAX_TOKENS
from typing import Optional
from openai_llm_provider import OpenAIServiceProvider
from llm_provider import (
    LLMServiceProvider,
    ChatMessage,
    ChatCompletionRequest,
    ResponseFormat,
)

__all__ = ["generate_tags", "batch_generate_tags"]


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
    result: list[str] = []
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


def generate_tags(
    content: str, llm_provider: Optional[LLMServiceProvider] = None
) -> list[str]:
    """Generate tags for the given document content using LLM service."""
    try:
        # Use provided LLM provider or default to OpenAI
        if llm_provider is None:
            llm_provider = OpenAIServiceProvider()

        system_prompt = _load_define_tags_prompt()
        user_prompt = (
            "Generate suitable tags for the following document content. "
            "Return ONLY a JSON object with a 'tags' array of strings.\n\n"
            f"Document content:\n{content}"
        )

        # Create chat completion request
        request = ChatCompletionRequest(
            messages=[
                ChatMessage(role="system", content=system_prompt),
                ChatMessage(role="user", content=user_prompt),
            ],
            response_format=ResponseFormat.JSON_OBJECT,
        )

        response = llm_provider.chat.create_completion(request)
        content_str = response.content or "{}"

        try:
            data = json.loads(content_str)
        except json.JSONDecodeError:
            # Attempt to extract JSON object from any surrounding text
            match = re.search(r"\{[\s\S]*\}", content_str)
            try:
                data = json.loads(match.group(0)) if match else {"tags": []}
            except json.JSONDecodeError:
                print(
                    f"[ERROR] Could not parse extracted JSON from LLM response: {content_str}"
                )
                data = {"tags": []}
        tags = _sanitize_tags(data.get("tags", []))
        return tags
    except Exception as e:
        print(f"[ERROR] LLM tag generation failed: {e}")
        return []


def batch_generate_tags(
    contents: list[str], llm_provider: Optional[LLMServiceProvider] = None
) -> list[list[str]]:
    """
    Generate tags for a list of document contents.

    - Batches inputs into multiple API calls when combined token count would
      exceed INPUT_MAX_TOKENS.
    - If an individual item exceeds INPUT_MAX_TOKENS by itself, it will be skipped
      and an empty tag list will be returned for that position.

    Args:
        contents (list[str]): A list of document contents.

    Returns:
        list[list[str]]: A list where each element is the list of tags for the
        corresponding input content (same order/length as inputs).
    """
    if not contents:
        return []

    try:
        # Use provided LLM provider or default to OpenAI
        if llm_provider is None:
            llm_provider = OpenAIServiceProvider()

        enc = tiktoken.encoding_for_model(MODEL)

        # Precompute token counts for each content
        content_token_counts: list[int] = [
            len(enc.encode(text or "")) for text in contents
        ]

        # Reserve some headroom for instructions/system and model response
        FIXED_OVERHEAD_TOKENS = 800  # Estimated tokens for system prompt, user prompt instructions, and response formatting.
        PER_ITEM_OVERHEAD_TOKENS = (
            24  # Estimated token overhead for each item's metadata in the batch prompt.
        )

        MAX_INPUT_BUDGET = max(1024, INPUT_MAX_TOKENS - FIXED_OVERHEAD_TOKENS)

        # Prepare result buffer aligned to input indices
        results: list[list[str]] = [[] for _ in contents]

        # Identify items that are individually too large; skip them with a warning
        indices_and_tokens = list(enumerate(content_token_counts))
        process_queue = [
            idx for idx, tks in indices_and_tokens if tks <= MAX_INPUT_BUDGET
        ]
        skipped_too_large = [
            idx for idx, tks in indices_and_tokens if tks > MAX_INPUT_BUDGET
        ]
        for idx in skipped_too_large:
            print(
                f"[WARN] batch_generate_tags: Item {idx} tokens {content_token_counts[idx]} exceed limit {MAX_INPUT_BUDGET}; returning empty tags."
            )

        if not process_queue:
            return results

        system_prompt = _load_define_tags_prompt()

        # Pack items into batches under the token budget
        batch: list[int] = []
        batch_tokens = 0

        def flush_batch(batch_indices: list[int]):
            if not batch_indices:
                return

            # Build user prompt with explicit indexes to preserve mapping
            parts: list[str] = [
                "Generate suitable tags for each of the following document contents.",
                "Return ONLY a JSON object with a 'results' array, where each item is",
                'an object { "index": number, "tags": string[] }.',
                "Use the provided index for each item. Do not include any text outside the JSON.",
                "\n\nDocument contents:\n",
            ]
            for i in batch_indices:
                parts.append(f"---\nindex: {i}\ncontent:\n{contents[i]}\n")
            user_prompt = "\n".join(parts)

            try:
                # Create chat completion request via provider
                request = ChatCompletionRequest(
                    messages=[
                        ChatMessage(role="system", content=system_prompt),
                        ChatMessage(role="user", content=user_prompt),
                    ],
                    response_format=ResponseFormat.JSON_OBJECT,
                )

                response = llm_provider.chat.create_completion(request)
                content_str = response.content or "{}"

                try:
                    data = json.loads(content_str)
                except json.JSONDecodeError:
                    # Attempt to extract JSON object from any surrounding text
                    match = re.search(r"\{[\s\S]*\}", content_str)
                    try:
                        data = json.loads(match.group(0)) if match else {"results": []}
                    except json.JSONDecodeError:
                        print(
                            f"[ERROR] Could not parse extracted JSON from LLM response (batch {batch_indices}): {content_str}"
                        )
                        data = {"results": []}

                raw_results = data.get("results", [])
                if isinstance(raw_results, list):
                    # Supported return shapes:
                    # 1) List of { index, tags }
                    # 2) List of tag arrays aligned with batch_indices
                    contains_objects = any(
                        isinstance(item, dict) for item in raw_results
                    )
                    if contains_objects:
                        for item in raw_results:
                            if isinstance(item, dict):
                                idx_val = item.get("index")
                                raw_tags = item.get("tags", [])
                                if isinstance(idx_val, int) and 0 <= idx_val < len(
                                    results
                                ):
                                    results[idx_val] = _sanitize_tags(raw_tags)
                    else:
                        for j, tags in enumerate(raw_results):
                            idx_val = (
                                batch_indices[j] if j < len(batch_indices) else None
                            )
                            if idx_val is not None:
                                results[idx_val] = _sanitize_tags(tags)
                else:
                    print(
                        f"[WARN] Unexpected 'results' format from LLM for batch {batch_indices}: {type(raw_results)}"
                    )
            except Exception as e:
                print(
                    f"[ERROR] LLM batch tag generation failed for batch {batch_indices}: {e}"
                )

        for idx in process_queue:
            item_tokens = content_token_counts[idx] + PER_ITEM_OVERHEAD_TOKENS
            if batch and batch_tokens + item_tokens > MAX_INPUT_BUDGET:
                flush_batch(batch)
                batch = []
                batch_tokens = 0
            batch.append(idx)
            batch_tokens += item_tokens

        # Flush any remaining items
        flush_batch(batch)

        return results
    except Exception as e:
        print(f"[ERROR] batch_generate_tags failed: {e}")
        # Return empty lists on failure, preserving length
        return [[] for _ in contents]


# TODO: Implement more tests
