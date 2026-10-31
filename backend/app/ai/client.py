"""Single gateway to the multimodal model (Claude or Gemini), with a keyless demo fallback."""
import base64
import logging
from typing import TypeVar

import anthropic
import httpx
import httpx2
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel, ValidationError

from ..config import Settings, get_settings
from ..images import ProcessedImage
from . import mock

log = logging.getLogger("construction_ai")
T = TypeVar("T", bound=BaseModel)

MAX_TOKENS = {"planning": 16000}
DEFAULT_MAX_TOKENS = 8000


class AIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _client(settings: Settings) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key or None, max_retries=2, timeout=180.0)


def _gemini_client(settings: Settings) -> genai.Client:
    # One attempt per model with a hard timeout: the fallback model acts as the retry, so a busy
    # free tier costs the user at most two timeouts instead of minutes of silent back-off.
    return genai.Client(api_key=settings.gemini_api_key, http_options=genai_types.HttpOptions(
        timeout=settings.gemini_timeout_s * 1000,
        retry_options=genai_types.HttpRetryOptions(
            attempts=1, http_status_codes=[500, 502, 503, 504]),
    ))


class _Overloaded(Exception):
    """Main model busy or timed out; worth trying the fallback model."""


def _validate(schema: type[T], text: str) -> T:
    try:
        return schema.model_validate_json(text)
    except ValidationError as e:
        log.warning("model output failed schema validation: %s", e)
        raise AIError(502, "The AI returned an unexpected format. Please try again.")


def run_analysis(*, kind: str, schema: type[T], system: str, user_text: str,
                 images: list[ProcessedImage], context: dict) -> tuple[T, str, str]:
    """Return (validated result, mode, model_name)."""
    settings = get_settings()
    if not settings.live:
        return mock.MOCKS[kind](context, len(images)), "demo", "demo-mock"
    if settings.provider == "gemini":
        models = settings.gemini_models
        for i, model in enumerate(models):
            try:
                return _run_gemini(settings, model, kind, schema, system, user_text, images), "live", model
            except _Overloaded as e:
                log.warning("gemini %s overloaded on %s: %s", kind, model, e)
                if i == len(models) - 1:
                    raise AIError(503, "Gemini is busy right now (high demand on the free tier). Try again in a minute.")
    return _run_claude(settings, kind, schema, system, user_text, images), "live", settings.claude_model


def _run_claude(settings, kind, schema, system, user_text, images):
    content: list[dict] = []
    for i, img in enumerate(images, 1):
        content.append({"type": "text", "text": f"Image {i}: {img.name} ({img.width}x{img.height})"})
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": img.media_type,
            "data": base64.standard_b64encode(img.data).decode()}})
    content.append({"type": "text", "text": user_text})

    claude = _client(settings)
    try:
        resp = claude.messages.create(
            model=settings.claude_model,
            max_tokens=MAX_TOKENS.get(kind, DEFAULT_MAX_TOKENS),
            system=system,
            messages=[{"role": "user", "content": content}],
            output_config={
                "effort": settings.claude_effort,
                "format": {"type": "json_schema", "schema": anthropic.transform_schema(schema.model_json_schema())},
            },
        )
    except anthropic.AuthenticationError:
        raise AIError(401, "Anthropic API key was rejected. Check ANTHROPIC_API_KEY in backend/.env.")
    except anthropic.RateLimitError:
        raise AIError(429, "The AI service is rate-limited right now. Try again shortly.")
    except anthropic.APIConnectionError:
        raise AIError(502, "Could not reach the AI service. Check your network connection.")
    except anthropic.BadRequestError as e:
        log.warning("bad request from API: %s", e)
        raise AIError(502, f"The AI service rejected the request: {getattr(e, 'message', e)}")
    except anthropic.APIStatusError as e:
        log.warning("api status error: %s", e)
        raise AIError(502, f"AI service error ({e.status_code}). Try again.")

    u = resp.usage
    log.info("claude %s: in=%s out=%s tokens", kind, u.input_tokens, u.output_tokens)
    # Check stop_reason before touching content: refusals and truncations are not valid JSON.
    if resp.stop_reason == "refusal":
        raise AIError(422, "The model declined to analyse this input.")
    if resp.stop_reason == "max_tokens":
        raise AIError(502, "The AI response was cut off. Try again with fewer or smaller images.")
    text = next((b.text for b in resp.content if b.type == "text"), "")
    return _validate(schema, text)


BLOCKED = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT"}


def _run_gemini(settings, model, kind, schema, system, user_text, images):
    parts: list = []
    for i, img in enumerate(images, 1):
        parts.append(f"Image {i}: {img.name} ({img.width}x{img.height})")
        parts.append(genai_types.Part.from_bytes(data=img.data, mime_type=img.media_type))
    parts.append(user_text)
    config = genai_types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json",
        response_schema=schema,
        # Gemini counts its internal thinking against this limit, so leave generous headroom.
        max_output_tokens=MAX_TOKENS.get(kind, DEFAULT_MAX_TOKENS) * 2,
    )
    # Keep a reference: the SDK closes its HTTP connection when the client is garbage-collected.
    gclient = _gemini_client(settings)
    try:
        resp = gclient.models.generate_content(model=model, contents=parts, config=config)
    except genai_errors.ClientError as e:
        log.warning("gemini client error %s: %s", e.code, e)
        if e.code == 429:
            raise AIError(429, "Gemini free-tier limit reached. Wait a minute and try again.")
        if e.code in (400, 401, 403) and "API key" in str(e):
            raise AIError(401, "Gemini API key was rejected. Check GEMINI_API_KEY in backend/.env.")
        if e.code == 404:
            raise AIError(502, f"Gemini model '{model}' is not available to this key. Set GEMINI_MODEL in backend/.env.")
        raise AIError(502, f"Gemini rejected the request ({e.code}).")
    except genai_errors.ServerError as e:
        raise _Overloaded(f"server error {e.code}")
    except (httpx.TimeoutException, httpx2.TimeoutException):
        raise _Overloaded(f"timed out after {settings.gemini_timeout_s}s")
    except (genai_errors.APIError, OSError) as e:
        log.warning("gemini call failed: %s", e)
        raise AIError(502, "Could not reach Gemini. Check your network connection.")

    u = resp.usage_metadata
    if u:
        log.info("gemini %s: in=%s out=%s thinking=%s tokens", kind, u.prompt_token_count,
                 u.candidates_token_count, u.thoughts_token_count)
    # Check why generation stopped before touching the text: blocked or cut-off output is not valid JSON.
    if resp.prompt_feedback and resp.prompt_feedback.block_reason:
        raise AIError(422, "Gemini declined to analyse this input.")
    finish = resp.candidates[0].finish_reason if resp.candidates else None
    finish_name = getattr(finish, "name", str(finish))
    if finish_name in BLOCKED:
        raise AIError(422, "Gemini declined to analyse this input.")
    if finish_name == "MAX_TOKENS":
        raise AIError(502, "The AI response was cut off. Try again with fewer or smaller images.")
    return _validate(schema, resp.text or "")
