"""FastAPI application served from a Cloudflare Container."""

from __future__ import annotations

import json
import os
import random
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from jsonschema import Draft202012Validator, ValidationError
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, ConfigDict

SCHEMA_DIR = Path(__file__).resolve().parents[1] / "schema"
JOKE_REQUEST_SCHEMA = json.loads((SCHEMA_DIR / "joke-request.schema.json").read_text())
JOKE_RESPONSE_SCHEMA = json.loads((SCHEMA_DIR / "joke-response.schema.json").read_text())

REQUEST_VALIDATOR = Draft202012Validator(JOKE_REQUEST_SCHEMA)
RESPONSE_VALIDATOR = Draft202012Validator(JOKE_RESPONSE_SCHEMA)

FALLBACK_JOKES = [
    "Why did the developer go broke? Because they used up all their cache!",
    "I tried to write a joke about UDP... but you might not get it.",
]


class JokeRequest(BaseModel):
    """Body schema for requesting a generated joke."""

    topic: str | None = None
    audience: str | None = None

    model_config = ConfigDict(extra="forbid")


class JokeResponse(BaseModel):
    """Shared response payload for a generated joke."""

    id: str
    message: str
    source: Literal["openai", "fallback"]

    model_config = ConfigDict(extra="forbid")


app = FastAPI(title="Cloudflare Container FastAPI Prototype")


@app.on_event("startup")
async def startup_event() -> None:
    """Log environment info at startup for debugging."""
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        # Only log that the key exists, not the actual value
        print(f"✓ OPENAI_API_KEY is set (length: {len(api_key)})")
    else:
        print("✗ OPENAI_API_KEY is NOT set - will use fallback jokes")
    print(f"FastAPI app started successfully")


def _validate_against_shared_schema(instance: dict[str, Any], *, validator: Draft202012Validator) -> None:
    try:
        validator.validate(instance)
    except ValidationError as exc:  # pragma: no cover - defensive logging path
        raise HTTPException(status_code=500, detail=f"Shared schema validation failed: {exc.message}") from exc


async def _generate_openai_joke(payload: JokeRequest) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("DEBUG: OPENAI_API_KEY not found in environment")
        raise OpenAIError("OPENAI_API_KEY is not configured for the container instance")

    print(f"DEBUG: Attempting to call OpenAI API...")

    client = AsyncOpenAI(api_key=api_key)
    prompt_parts = ["Tell me a short, family-friendly programming joke."]
    if payload.topic:
        prompt_parts.append(f"Focus on the topic: {payload.topic}.")
    if payload.audience:
        prompt_parts.append(f"Make it resonate with this audience: {payload.audience}.")

    response = await client.responses.create(
        model="gpt-4o-mini",
        input=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": " ".join(prompt_parts),
                    }
                ],
            }
        ],
        max_output_tokens=120,
    )
    if not response.output:
        print("DEBUG: OpenAI returned no output")
        raise OpenAIError("No output returned from OpenAI")
    print(f"DEBUG: OpenAI API call successful")
    return response.output_text.strip()


async def build_joke(payload: JokeRequest) -> tuple[str, Literal["openai", "fallback"]]:
    try:
        joke_text = await _generate_openai_joke(payload)
        if not joke_text:
            raise OpenAIError("Generated text was empty")
        return joke_text, "openai"
    except (OpenAIError, RuntimeError) as exc:
        # Fall back to a deterministic joke so that the prototype remains usable without OpenAI
        print(f"DEBUG: Falling back to deterministic joke. Reason: {type(exc).__name__}: {exc}")
        return random.choice(FALLBACK_JOKES), "fallback"


@app.get("/health", response_model=dict[str, str])
async def health() -> dict[str, str]:
    """Simple health endpoint used by the Worker to confirm container readiness."""

    return {"status": "ok"}


@app.get("/debug/env")
async def debug_env() -> dict[str, Any]:
    """Debug endpoint to check environment variables (remove in production)."""
    api_key = os.getenv("OPENAI_API_KEY")
    return {
        "version": "1",
        "has_openai_key": bool(api_key),
        "openai_key_length": len(api_key) if api_key else 0,
        "openai_key_prefix": api_key[:7] if api_key and len(api_key) > 7 else None,
    }


@app.post("/joke", response_model=JokeResponse)
async def joke(request: JokeRequest) -> JokeResponse:
    """Generate or fall back to a shared-schema compliant joke payload."""

    payload = request.model_dump(exclude_none=True)
    _validate_against_shared_schema(payload, validator=REQUEST_VALIDATOR)

    message, source = await build_joke(request)
    response = JokeResponse(id=str(uuid.uuid4()), message=message, source=source)
    response_payload = response.model_dump()
    _validate_against_shared_schema(response_payload, validator=RESPONSE_VALIDATOR)
    return response


@app.get("/", response_model=dict[str, str])
async def root() -> dict[str, str]:
    """Return metadata useful during manual smoke tests."""

    return {
        "service": "cloudflare-container-fastapi",
        "schema": JOKE_RESPONSE_SCHEMA["$id"],
    }
