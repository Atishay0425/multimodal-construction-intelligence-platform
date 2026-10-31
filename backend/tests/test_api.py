import io
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services.planning_math import normalise_schedule
from app import schemas as s

client = TestClient(app)


def png_bytes(size=(320, 240), fmt="PNG"):
    buf = io.BytesIO()
    Image.new("RGB", size, (120, 130, 140)).save(buf, fmt)
    return buf.getvalue()


def img(name="site.png", data=None, mime="image/png"):
    return ("images", (name, data or png_bytes(), mime))


def test_health_demo_mode():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["mode"] == "demo"


@pytest.mark.parametrize("path", ["/api/safety/analyze", "/api/cracks/analyze"])
def test_image_modules_return_valid_schema(path):
    r = client.post(path, files=[img()], data={"notes": "test"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "demo" and body["image_urls"]
    model = s.SafetyReport if "safety" in path else s.CrackReport
    model.model_validate(body["result"])
    assert client.get(body["image_urls"][0]).status_code == 200


@pytest.mark.parametrize("path", ["/api/safety/analyze", "/api/cracks/analyze"])
def test_image_required(path):
    assert client.post(path, data={"notes": "x"}).status_code == 422


def test_incomplete_image_rejected():
    data = png_bytes((800, 600))
    r = client.post("/api/safety/analyze", files=[img(data=data[: len(data) // 2])])
    assert r.status_code == 422 and "not a readable image" in r.json()["detail"]


def test_non_image_rejected():
    r = client.post("/api/cracks/analyze", files=[img("a.png", b"not an image at all")])
    assert r.status_code == 422


def test_unsupported_format_rejected():
    r = client.post("/api/cracks/analyze", files=[img("a.bmp", png_bytes(fmt="BMP"), "image/bmp")])
    assert r.status_code == 415


def test_tiny_image_rejected():
    r = client.post("/api/cracks/analyze", files=[img(data=png_bytes((10, 10)))])
    assert r.status_code == 422


def test_too_many_images():
    r = client.post("/api/safety/analyze", files=[img()] * 6)
    assert r.status_code == 422


def test_valuation_without_images():
    r = client.post("/api/valuation/estimate", data={
        "property_type": "apartment", "location": "Indore", "area_sqft": "1200",
        "condition": "good", "currency": "INR"})
    assert r.status_code == 200, r.text
    v = s.ValuationReport.model_validate(r.json()["result"])
    assert v.low_estimate < v.estimated_value < v.high_estimate


def test_valuation_validation():
    r = client.post("/api/valuation/estimate", data={"property_type": "x", "location": "y", "area_sqft": "-5"})
    assert r.status_code == 422
    assert client.post("/api/valuation/estimate", data={"property_type": "x"}).status_code == 422


def test_planning_totals_recomputed():
    r = client.post("/api/planning/generate", data={
        "description": "Two-storey house", "built_up_area_sqm": "180", "floors": "2", "location": "Bhopal"})
    assert r.status_code == 200, r.text
    p = s.PlanningReport.model_validate(r.json()["result"])
    assert p.cost_summary.materials_total == pytest.approx(sum(m.quantity * m.unit_cost for m in p.materials), abs=0.5)
    cs = p.cost_summary
    assert cs.grand_total == pytest.approx(cs.materials_total + cs.labour_total + cs.equipment_total + cs.contingency, abs=0.5)
    assert p.total_duration_days == max(t.start_day + t.duration_days for t in p.schedule)
    by_id = {t.id: t for t in p.schedule}
    for t in p.schedule:
        for d in t.depends_on:
            assert t.start_day >= by_id[d].start_day + by_id[d].duration_days


def test_schedule_handles_cycles_and_bad_deps():
    t = lambda i, deps, d=2: s.ScheduleTask(id=i, name=i, phase="p", duration_days=d, depends_on=deps, start_day=0)
    tasks = [t("a", ["b", "ghost"]), t("b", ["a"]), t("c", ["c"], 0)]
    total = normalise_schedule(tasks)
    assert total > 0 and all(x.start_day >= 0 for x in tasks)


def test_assistant_daily_degrades_without_weather(monkeypatch):
    monkeypatch.setattr("app.services.analysis.fetch_forecast", lambda loc: None)
    r = client.post("/api/assistant/daily", data={"location": "Nowhereville", "activities": "pour slab, bricklaying"})
    assert r.status_code == 200, r.text
    s.DailyBriefing.model_validate(r.json()["result"])


def test_knowledge_chat():
    r = client.post("/api/knowledge/chat", json={"messages": [{"role": "user", "content": "What is M25 concrete?"}]})
    assert r.status_code == 200
    s.KnowledgeAnswer.model_validate(r.json()["result"])


def test_knowledge_chat_validation():
    assert client.post("/api/knowledge/chat", json={"messages": []}).status_code == 422
    bad = {"messages": [{"role": "assistant", "content": "hi"}]}
    assert client.post("/api/knowledge/chat", json=bad).status_code == 422


def test_history_roundtrip_and_delete():
    r = client.post("/api/cracks/analyze", files=[img()])
    aid = r.json()["id"]
    assert any(h["id"] == aid for h in client.get("/api/history", params={"kind": "cracks"}).json())
    assert client.get(f"/api/history/{aid}").json()["id"] == aid
    assert client.delete(f"/api/history/{aid}").status_code == 200
    assert client.get(f"/api/history/{aid}").status_code == 404


# Regressions found by the QA agents.

@pytest.mark.parametrize("field,value", [("area_sqft", "nan"), ("area_sqft", "inf"), ("area_sqft", "1e400"),
                                         ("age_years", "nan"), ("bedrooms", "-3")])
def test_valuation_rejects_non_finite_or_out_of_range(field, value):
    data = {"property_type": "apartment", "location": "Pune", "area_sqft": "1000", field: value}
    r = client.post("/api/valuation/estimate", data=data)
    assert r.status_code == 422, r.text
    assert client.get("/api/history").status_code == 200


@pytest.mark.parametrize("field,value", [("budget", "nan"), ("built_up_area_sqm", "inf"), ("budget", "-100"),
                                         ("floors", "1000000"), ("target_months", "0")])
def test_planning_rejects_non_finite_or_out_of_range(field, value):
    data = {"description": "house", "built_up_area_sqm": "100", field: value}
    assert client.post("/api/planning/generate", data=data).status_code == 422
    assert client.get("/api/history").status_code == 200


def test_wildcard_delete_does_not_remove_other_uploads():
    r = client.post("/api/safety/analyze", files=[img()])
    url = r.json()["image_urls"][0]
    for bad in ("*", "?" * 32, "[0-9a-f]" * 4):
        assert client.delete(f"/api/history/{quote(bad, safe='')}").status_code == 404
    assert client.get(url).status_code == 200


def test_decompression_bomb_is_rejected_cleanly():
    buf = io.BytesIO()
    Image.new("1", (20000, 20000)).save(buf, "PNG")  # ~50 KB file, 400 megapixels
    r = client.post("/api/safety/analyze", files=[img(data=buf.getvalue())])
    assert r.status_code == 413 and "detail" in r.json()


def test_blank_question_is_rejected():
    r = client.post("/api/knowledge/chat", json={"messages": [{"role": "user", "content": "   "}]})
    assert r.status_code == 422
