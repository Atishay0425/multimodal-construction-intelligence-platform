"""Re-run the real-photo tests against a running backend and save the results for the Testing page.

    cd backend && .venv/bin/python scripts/run_photo_tests.py

Needs the backend running with a live key (default http://127.0.0.1:8000, override with BASE_URL).
Each run makes one real AI call, so on the Gemini free tier it takes a few minutes.
"""
import json
import os
import pathlib
import time

import httpx

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "testing"
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000")

RUNS = [  # (photo slug, endpoint, form fields)
    ("fall-protection", "/api/safety/analyze", {"site_type": "Commercial building", "notes": "Steel frame erection, high-rise."}),
    ("scaffolding", "/api/safety/analyze", {"site_type": "Residential building", "notes": "Plastering the upper storey from timber scaffolding."}),
    ("workers-building", "/api/safety/analyze", {"site_type": "Commercial building", "notes": "Wall formwork and rebar in progress."}),
    ("wall-crack", "/api/cracks/analyze", {"element": "Wall", "notes": "Old brick church facade."}),
    ("retaining-wall-crack", "/api/cracks/analyze", {"element": "Wall", "notes": "Concrete block retaining wall next to a tree."}),
]


def main():
    http = httpx.Client(base_url=BASE_URL, timeout=300)
    health = http.get("/api/health").json()
    if health["mode"] != "live":
        raise SystemExit("The backend is in demo mode. Set GEMINI_API_KEY or ANTHROPIC_API_KEY first.")
    for slug, path, form in RUNS:
        photo = (OUT / f"{slug}.jpg").read_bytes()
        r = http.post(path, data=form, files=[("images", (f"{slug}.jpg", photo, "image/jpeg"))])
        print(slug, r.status_code, flush=True)
        if r.status_code != 200:
            print("  ", r.text[:300])
            time.sleep(20)
            continue
        env = r.json()
        http.delete(f"/api/history/{env['id']}")  # keep the saved-reports list clean
        env["image_urls"] = [f"/testing/{slug}.jpg"]  # point at the committed photo
        env["context"] = {**env.get("context", {}), "testing": True}
        (OUT / f"{slug}.json").write_text(json.dumps({"envelope": env}, indent=1))
        time.sleep(8)  # stay under the free-tier rate limit


if __name__ == "__main__":
    main()
