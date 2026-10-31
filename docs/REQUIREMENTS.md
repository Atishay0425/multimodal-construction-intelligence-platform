# Requirements Specification

Multimodal Construction Intelligence Platform — Epic 1 deliverable.

## 1. Purpose

Give construction professionals AI decision support across planning, execution and monitoring by
analysing **text, site images and structured project data** and returning consistent, actionable,
machine-readable insights.

## 2. Users

| User | Needs |
|---|---|
| Site engineer / supervisor | Daily go/no-go, safety checks, crack triage |
| Project planner / estimator | Material quantities, cost, schedule |
| Property owner / buyer | Indicative valuation, condition assessment |
| Student / trainee | Construction knowledge Q&A |

## 3. Functional requirements

| ID | Requirement | Module | Epic |
|---|---|---|---|
| FR-1 | Accept 1–5 site photos (JPEG/PNG/WEBP/GIF) plus optional notes | All image modules | 2 |
| FR-2 | Detect PPE compliance, fall-protection, housekeeping, equipment, electrical, excavation and fire hazards; give severity, location in frame and corrective action | Safety | 2 |
| FR-3 | Produce a 0–100 risk score and prioritised immediate actions | Safety | 2 |
| FR-4 | Identify crack type, orientation, visual width estimate, severity, probable causes and actions; flag when a structural engineer is required | Cracks | 2 |
| FR-5 | Recommend a crack monitoring plan | Cracks | 2 |
| FR-6 | Estimate property value with low/high range, price per sq ft, value drivers and risks, using optional photos for condition | Valuation | 3 |
| FR-7 | Generate a bill of materials with quantities and unit costs | Planning | 3 |
| FR-8 | Produce a cost summary (materials, labour, equipment, contingency) and compare to budget | Planning | 3 |
| FR-9 | Produce a dependency-aware task schedule shown as a Gantt chart | Planning | 3 |
| FR-10 | Produce an architectural concept with a room list rendered as a floor plan | Planning | 3 |
| FR-11 | Fetch a live forecast for the site location and give a go / caution / hold decision with per-activity weather impact | Daily Assistant | 5 |
| FR-12 | Answer construction questions with key points and referenced standards, keeping conversation context | Knowledge | 5 |
| FR-13 | Persist every analysis (inputs, images, results) and allow review and deletion | History | 4 |
| FR-14 | Export any report as PDF (print) or JSON | All | 6 |

## 4. Non-functional requirements

| ID | Requirement | How it is met |
|---|---|---|
| NFR-1 | **Strict JSON contracts** — every AI response matches a fixed schema | Pydantic schemas sent as Claude structured-output format; validated again server-side |
| NFR-2 | **Derived numbers are trustworthy** | Material totals, grand total and schedule dates recomputed by the server |
| NFR-3 | **Robust input handling** | Rejects empty, corrupt, truncated, unsupported, tiny, oversized and too-many images with clear messages |
| NFR-4 | **Honest output on poor images** | Prompts require quality notes, lower confidence and no invented findings |
| NFR-5 | **Graceful failure** | Refusals, truncation, rate limits, auth and network errors mapped to readable HTTP errors; weather outage falls back to general advice |
| NFR-6 | **Secrets stay server-side** | API keys only in `backend/.env` (git-ignored), never sent to the browser |
| NFR-7 | **Cost protection when public** | Optional access password; per-IP hourly rate limit on AI endpoints |
| NFR-8 | **Runs without credentials** | Demo mode returns schema-identical sample data |
| NFR-9 | **Responsive and accessible UI** | Works at 375 px width; keyboard-operable controls; light/dark themes |
| NFR-10 | **Single deployable unit** | FastAPI serves the built React app; one process, one URL |

## 5. Environment

* Backend: Python 3.9+, FastAPI, Anthropic SDK, Pillow, SQLite
* Frontend: Node 18+, React 18, Vite 5
* External services: Google Gemini API (free tier) or Anthropic API (Claude), Open-Meteo (weather, no key)

## 6. Acceptance tests

Automated (`cd backend && .venv/bin/python -m pytest -q`): every endpoint's schema, upload edge
cases, planning maths including cyclic/invalid dependencies, history CRUD, password gate, rate
limiting (including spoofed `X-Forwarded-For`), and the live Claude path against a fake transport
(request shape, refusal, truncation, auth error, malformed output).

Manual: run each module in the browser, check results render, print a report, check phone layout.

## 7. Out of scope / limitations

* Not a certified structural inspection or property appraisal.
* Visual crack widths need a scale reference in the photo.
* No multi-user accounts; the password gate is a single shared password.
