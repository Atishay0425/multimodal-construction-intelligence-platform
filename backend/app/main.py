import hmac
import logging
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
    if not hmac.compare_digest(req.password, settings.app_password):
        raise HTTPException(401, "Wrong password.")
    response.set_cookie(COOKIE, auth_token(settings.app_password), httponly=True, samesite="lax",
                        secure=request.url.scheme == "https", max_age=7 * 24 * 3600)
    return {"authenticated": True}


@app.post("/api/safety/analyze")
def safety(images: Images = None, notes: str = Form(""), site_type: str = Form("")):
    return analysis.safety(process_uploads(images, required=True), notes.strip(), site_type.strip())


@app.post("/api/cracks/analyze")
def cracks(images: Images = None, notes: str = Form(""), element: str = Form("")):
    return analysis.cracks(process_uploads(images, required=True), notes.strip(), element.strip())


@app.post("/api/valuation/estimate")
def valuation(
    images: Images = None,
    property_type: str = Form(...), location: str = Form(...), area_sqft: float = Form(...),
    bedrooms: int | None = Form(None), bathrooms: int | None = Form(None),
    age_years: float | None = Form(None),
    condition: str = Form("good"), amenities: str = Form(""), notes: str = Form(""),
    currency: str = Form("INR"),
):
    if area_sqft <= 0:
        raise HTTPException(422, "area_sqft must be greater than 0.")
    ctx = dict(property_type=property_type.strip(), location=location.strip(), area_sqft=area_sqft,
               bedrooms=bedrooms, bathrooms=bathrooms, age_years=age_years, condition=condition,
               amenities=amenities.strip(), notes=notes.strip(), currency=currency.strip().upper())
    return analysis.valuation(process_uploads(images), ctx)


@app.post("/api/planning/generate")
def planning(
    images: Images = None,
    description: str = Form(...), location: str = Form(""), built_up_area_sqm: float = Form(...),
    floors: int = Form(1), budget: float | None = Form(None), currency: str = Form("INR"),
    target_months: int | None = Form(None),
):
    if built_up_area_sqm <= 0 or floors < 1:
        raise HTTPException(422, "Area must be positive and floors at least 1.")
    ctx = dict(description=description.strip(), location=location.strip(), built_up_area_sqm=built_up_area_sqm,
               floors=floors, budget=budget, currency=currency.strip().upper(), target_months=target_months)
    return analysis.planning(process_uploads(images), ctx)


@app.post("/api/assistant/daily")
def daily(images: Images = None, location: str = Form(""), activities: str = Form(""), notes: str = Form("")):
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
    return analysis.knowledge([m.model_dump() for m in req.messages])


@app.get("/api/history")
def history(kind: str | None = None, limit: int = 50):
    return storage.list_analyses(kind, min(max(limit, 1), 200))


@app.get("/api/history/{analysis_id}")
def history_item(analysis_id: str):
    row = storage.get_analysis(analysis_id)
    if not row:
        raise HTTPException(404, "Not found.")
    return row


@app.delete("/api/history/{analysis_id}")
def history_delete(analysis_id: str):
    if not storage.delete_analysis(analysis_id):
        raise HTTPException(404, "Not found.")
    return {"deleted": analysis_id}


# In production the backend also serves the built React app (one process, one URL).
# Mounted last so every /api route above takes priority.
if settings.frontend_dist.joinpath("index.html").exists():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
