"""Single gateway to the multimodal model (Claude), with a keyless demo fallback."""
import base64
import logging
from typing import TypeVar

import anthropic
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


def run_analysis(*, kind: str, schema: type[T], system: str, user_text: str,
                 images: list[ProcessedImage], context: dict) -> tuple[T, str, str]:
    """Return (validated result, mode, model_name)."""
    settings = get_settings()
    if not settings.live:
        return mock.MOCKS[kind](context, len(images)), "demo", "demo-mock"

    content: list[dict] = []
    for i, img in enumerate(images, 1):
        content.append({"type": "text", "text": f"Image {i}: {img.name} ({img.width}x{img.height})"})
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": img.media_type,
            "data": base64.standard_b64encode(img.data).decode()}})
    content.append({"type": "text", "text": user_text})

    try:
        resp = _client(settings).messages.create(
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

    # Check stop_reason before touching content: refusals and truncations are not valid JSON.
    if resp.stop_reason == "refusal":
        raise AIError(422, "The model declined to analyse this input.")
    if resp.stop_reason == "max_tokens":
        raise AIError(502, "The AI response was cut off. Try again with fewer or smaller images.")
    text = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        return schema.model_validate_json(text), "live", settings.claude_model
    except ValidationError as e:
        log.warning("model output failed schema validation: %s", e)
        raise AIError(502, "The AI returned an unexpected format. Please try again.")
