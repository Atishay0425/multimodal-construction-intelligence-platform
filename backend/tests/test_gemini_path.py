"""Exercise the live Gemini code path against a fake HTTP transport (no network, no key)."""
import json

import httpx
import pytest
from google import genai
from google.genai import types

from app.ai import client as ai
from app.ai import mock
from app.config import get_settings
from app.images import ProcessedImage
from app import schemas as s


def response(text, finish="STOP"):
    return {"candidates": [{"content": {"role": "model", "parts": [{"text": text}]}, "finishReason": finish}],
            "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 10}}


@pytest.fixture
def gemini(monkeypatch):
    st = get_settings()
    monkeypatch.setattr(st, "ai_mode", "auto")
    monkeypatch.setattr(st, "ai_provider", "auto")
    monkeypatch.setattr(st, "anthropic_api_key", "")
    monkeypatch.setattr(st, "gemini_api_key", "test")
    monkeypatch.setattr(ai, "_gemini_client", None)


def run(monkeypatch, handler):
    fake = genai.Client(api_key="test", http_options=types.HttpOptions(
        httpx_client=httpx.Client(transport=httpx.MockTransport(handler))))
    monkeypatch.setattr(ai, "_gemini_client", lambda settings: fake)
    img = ProcessedImage(name="a.jpg", data=b"\xff\xd8fake", width=100, height=80)
    return ai.run_analysis(kind="cracks", schema=s.CrackReport, system="sys", user_text="go",
                           images=[img], context={})


def test_provider_auto_selects_gemini(gemini):
    st = get_settings()
    assert st.provider == "gemini" and st.live and st.model_name == st.gemini_model


def test_claude_preferred_when_both_keys(gemini, monkeypatch):
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "x")
    assert get_settings().provider == "anthropic"


def test_gemini_request_shape_and_parse(gemini, monkeypatch):
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=response(mock.cracks({}, 1).model_dump_json()))

    result, mode, model = run(monkeypatch, handler)
    body = seen["body"]
    assert mode == "live" and model == get_settings().gemini_model and isinstance(result, s.CrackReport)
    assert get_settings().gemini_model in seen["url"]
    gc = body["generationConfig"]
    assert gc["responseMimeType"] == "application/json" and gc["responseSchema"]
    parts = body["contents"][0]["parts"]
    assert any("inlineData" in p for p in parts)
    assert body["systemInstruction"]["parts"][0]["text"] == "sys"


@pytest.mark.parametrize("finish,status", [("SAFETY", 422), ("MAX_TOKENS", 502)])
def test_gemini_bad_finish_reasons(gemini, monkeypatch, finish, status):
    with pytest.raises(ai.AIError) as e:
        run(monkeypatch, lambda r: httpx.Response(200, json=response("{", finish)))
    assert e.value.status == status


def test_gemini_rate_limit_mapped(gemini, monkeypatch):
    err = {"error": {"code": 429, "message": "Resource exhausted", "status": "RESOURCE_EXHAUSTED"}}
    with pytest.raises(ai.AIError) as e:
        run(monkeypatch, lambda r: httpx.Response(429, json=err))
    assert e.value.status == 429


def test_gemini_bad_key_mapped(gemini, monkeypatch):
    err = {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}}
    with pytest.raises(ai.AIError) as e:
        run(monkeypatch, lambda r: httpx.Response(400, json=err))
    assert e.value.status == 401


def test_gemini_malformed_output(gemini, monkeypatch):
    with pytest.raises(ai.AIError) as e:
        run(monkeypatch, lambda r: httpx.Response(200, json=response('{"summary": "x"}')))
    assert e.value.status == 502


def test_gemini_falls_back_when_overloaded(gemini, monkeypatch):
    st = get_settings()
    seen = []

    def handler(request):
        seen.append(str(request.url))
        last = st.gemini_models[-1]
        if not str(request.url).split("/models/")[1].startswith(last + ":"):
            return httpx.Response(503, json={"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})
        return httpx.Response(200, json=response(mock.cracks({}, 1).model_dump_json()))

    result, mode, model = run(monkeypatch, handler)
    # Every model in the chain was tried, in order, and the last one answered.
    assert model == st.gemini_models[-1] and isinstance(result, s.CrackReport)
    assert [u.split("/models/")[1].split(":")[0] for u in seen] == st.gemini_models


def test_gemini_both_models_overloaded(gemini, monkeypatch):
    busy = {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}}
    with pytest.raises(ai.AIError) as e:
        run(monkeypatch, lambda r: httpx.Response(503, json=busy))
    assert e.value.status == 503 and "busy" in e.value.message
