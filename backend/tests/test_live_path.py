"""Exercise the live Claude code path against a fake HTTP transport (no network, no key)."""
import json

import anthropic
import httpx2
import pytest

from app.ai import client as ai
from app.ai import mock
from app.config import get_settings
from app.images import ProcessedImage
from app import schemas as s


def fake_anthropic(handler):
    return anthropic.Anthropic(api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(handler)))


def message(text, stop="end_turn"):
    return {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
            "content": [{"type": "text", "text": text}], "stop_reason": stop, "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 10}}


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_mode", "live")
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "test")


def run(handler):
    img = ProcessedImage(name="a.jpg", data=b"\xff\xd8fake", width=100, height=80)
    ai._client = lambda settings: fake_anthropic(handler)
    return ai.run_analysis(kind="safety", schema=s.SafetyReport, system="sys", user_text="go",
                           images=[img], context={})


def test_live_request_shape_and_parse(live):
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return httpx2.Response(200, json=message(mock.safety({}, 1).model_dump_json()))

    result, mode, model = run(handler)
    body = seen["body"]
    assert mode == "live" and model == get_settings().claude_model
    assert isinstance(result, s.SafetyReport)
    assert body["output_config"]["effort"] == get_settings().claude_effort
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert any(b["type"] == "image" for b in body["messages"][0]["content"])
    assert "thinking" not in body and "temperature" not in body


@pytest.mark.parametrize("stop,status", [("refusal", 422), ("max_tokens", 502)])
def test_live_bad_stop_reasons(live, stop, status):
    with pytest.raises(ai.AIError) as e:
        run(lambda r: httpx2.Response(200, json=message("{}", stop)))
    assert e.value.status == status


def test_live_auth_error_mapped(live):
    err = {"type": "error", "error": {"type": "authentication_error", "message": "bad key"}}
    with pytest.raises(ai.AIError) as e:
        run(lambda r: httpx2.Response(401, json=err))
    assert e.value.status == 401


def test_live_malformed_json_mapped(live):
    with pytest.raises(ai.AIError) as e:
        run(lambda r: httpx2.Response(200, json=message('{"summary": "only one field"}')))
    assert e.value.status == 502
