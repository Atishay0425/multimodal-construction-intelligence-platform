import hmac
import logging
import math
import re
from typing import Annotated

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import storage
from .ai.client import AIError
from .config import get_settings
from .images import process_uploads
from .security import COOKIE, auth_token, is_authenticated, security_middleware
from .services import analysis

logging.basicConfig(level=logging.INFO)
settings = get_settings()
settings.data_dir.joinpath("uploads").mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Multimodal Construction Intelligence Platform", version="1.0.0")
# Middleware runs last-added-first: CORS wraps the security check so 401/429 still carry CORS headers.
app.middleware("http")(security_middleware)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_methods=["*"],
                   allow_headers=["*"], allow_credentials=True)
app.mount("/uploads", StaticFiles(directory=settings.data_dir / "uploads"), name="uploads")

Images = Annotated[list[UploadFile] | None, File(description="Site/property photos")]
def Text(default: str = "", n: int = 2000):  # noqa: N802 - reads like a type in signatures
    return Form(default, max_length=n)


ID_RE = re.compile(r"^[0-9a-f]{32}$")


def _check(name: str, value: float | None, low: float, high: float, *, low_inclusive: bool = False):
    """Reject NaN/inf and out-of-range numbers before they reach the model or the database."""
    if value is None:
        return
    too_low = value < low if low_inclusive else value <= low
    if not math.isfinite(value) or too_low or value > high:
        bound = f"at least {low:g}" if low_inclusive else f"greater than {low:g}"
        raise HTTPException(422, f"{name} must be a number {bound} and at most {high:g}.")


@app.exception_handler(AIError)
async def ai_error_handler(_: Request, exc: AIError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


@app.get("/api/health")
def health(request: Request):
    return {"status": "ok", "mode": "live" if settings.live else "demo",
            "provider": settings.provider if settings.live else "demo",
            "model": settings.model_name if settings.live else "demo-mock",
            "auth_required": bool(settings.app_password),
            "authenticated": is_authenticated(request)}


class AuthRequest(BaseModel):
    password: str = Field(max_length=200)


@app.post("/api/auth")
def login(req: AuthRequest, request: Request, response: Response):
    if not settings.app_password:
        return {"authenticated": True}
    if not hmac.compare_digest(req.password.encode(), settings.app_password.encode()):
        raise HTTPException(401, "Wrong password.")
    response.set_cookie(COOKIE, auth_token(settings.app_password), httponly=True, samesite="lax",
                        secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https",
                        max_age=7 * 24 * 3600)
    return {"authenticated": True}


@app.post("/api/safety/analyze")
def safety(images: Images = None, notes: str = Text(), site_type: str = Text(n=200)):
    return analysis.safety(process_uploads(images, required=True), notes.strip(), site_type.strip())


@app.post("/api/cracks/analyze")
def cracks(images: Images = None, notes: str = Text(), element: str = Text(n=200)):
    return analysis.cracks(process_uploads(images, required=True), notes.strip(), element.strip())


@app.post("/api/valuation/estimate")
def valuation(
    images: Images = None,
    property_type: str = Form(..., max_length=200), location: str = Form(..., max_length=300),
    area_sqft: float = Form(...),
    bedrooms: int | None = Form(None), bathrooms: int | None = Form(None),
    age_years: float | None = Form(None),
    condition: str = Text("good", 50), amenities: str = Text(), notes: str = Text(),
    currency: str = Text("INR", 10),
):
    if not location.strip() or not property_type.strip():
        raise HTTPException(422, "Enter the property type and location.")
    _check("Area (sq ft)", area_sqft, 0, 10_000_000)
    _check("Bedrooms", bedrooms, 0, 100, low_inclusive=True)
    _check("Bathrooms", bathrooms, 0, 100, low_inclusive=True)
    _check("Age (years)", age_years, 0, 500, low_inclusive=True)
    ctx = dict(property_type=property_type.strip(), location=location.strip(), area_sqft=area_sqft,
               bedrooms=bedrooms, bathrooms=bathrooms, age_years=age_years, condition=condition,
               amenities=amenities.strip(), notes=notes.strip(), currency=currency.strip().upper())
    return analysis.valuation(process_uploads(images), ctx)


@app.post("/api/planning/generate")
def planning(
    images: Images = None,
    description: str = Form(..., max_length=4000), location: str = Text(n=300), built_up_area_sqm: float = Form(...),
    floors: int = Form(1), budget: float | None = Form(None), currency: str = Text("INR", 10),
    target_months: int | None = Form(None),
):
    if not description.strip():
        raise HTTPException(422, "Describe the project first.")
    _check("Built-up area (m²)", built_up_area_sqm, 0, 1_000_000)
    _check("Floors", floors, 1, 200, low_inclusive=True)
    _check("Budget", budget, 0, 1e13)
    _check("Target months", target_months, 1, 240, low_inclusive=True)
    ctx = dict(description=description.strip(), location=location.strip(), built_up_area_sqm=built_up_area_sqm,
               floors=floors, budget=budget, currency=currency.strip().upper(), target_months=target_months)
    return analysis.planning(process_uploads(images), ctx)


@app.post("/api/assistant/daily")
def daily(images: Images = None, location: str = Text(n=300), activities: str = Text(), notes: str = Text()):
    acts = [a.strip() for a in activities.split(",") if a.strip()]
    return analysis.assistant(process_uploads(images), location.strip(), acts, notes.strip())


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


@app.post("/api/knowledge/chat")
def knowledge(req: Annotated[ChatRequest, Body()]):
    if req.messages[-1].role != "user":
        raise HTTPException(422, "The last message must be from the user.")
    if not req.messages[-1].content.strip():
        raise HTTPException(422, "Type a question first.")
    return analysis.knowledge([m.model_dump() for m in req.messages])


@app.get("/api/history")
def history(kind: str | None = None, limit: int = 50):
    return storage.list_analyses(kind, min(max(limit, 1), 200))


@app.get("/api/history/{analysis_id}")
def history_item(analysis_id: str):
    row = storage.get_analysis(analysis_id) if ID_RE.match(analysis_id) else None
    if not row:
        raise HTTPException(404, "Not found.")
    return row


@app.delete("/api/history/{analysis_id}")
def history_delete(analysis_id: str):
    if not ID_RE.match(analysis_id) or not storage.delete_analysis(analysis_id):
        raise HTTPException(404, "Not found.")
    return {"deleted": analysis_id}


# In production the backend also serves the built React app (one process, one URL).
# Mounted last so every /api route above takes priority.
if settings.frontend_dist.joinpath("index.html").exists():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
