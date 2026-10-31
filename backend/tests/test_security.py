import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.security import limiter


@pytest.fixture
def client():
    limiter.reset()
    yield TestClient(app)
    limiter.reset()


ASK = {"messages": [{"role": "user", "content": "What is curing?"}]}


def test_no_password_means_open(client):
    h = client.get("/api/health").json()
    assert h["auth_required"] is False and h["authenticated"] is True
    assert client.post("/api/knowledge/chat", json=ASK).status_code == 200


def test_password_gate(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_password", "s3cret")
    h = client.get("/api/health").json()
    assert h["auth_required"] is True and h["authenticated"] is False
    assert client.get("/api/history").status_code == 401
    assert client.post("/api/knowledge/chat", json=ASK).status_code == 401
    assert client.get("/uploads/anything.jpg").status_code == 401
    assert client.post("/api/auth", json={"password": "wrong"}).status_code == 401
    r = client.post("/api/auth", json={"password": "s3cret"})
    assert r.status_code == 200 and "mcip_auth" in r.cookies
    assert client.get("/api/health").json()["authenticated"] is True
    assert client.post("/api/knowledge/chat", json=ASK).status_code == 200


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_per_hour", 2)
    assert client.post("/api/knowledge/chat", json=ASK).status_code == 200
    assert client.post("/api/knowledge/chat", json=ASK).status_code == 200
    r = client.post("/api/knowledge/chat", json=ASK)
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 0
    # Reading history is not metered.
    assert client.get("/api/history").status_code == 200


def test_rate_limit_ignores_spoofed_forwarded_for(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_per_hour", 1)
    assert client.post("/api/knowledge/chat", json=ASK, headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert client.post("/api/knowledge/chat", json=ASK, headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 429
