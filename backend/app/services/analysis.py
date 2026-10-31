"""One function per platform capability. Each builds the user prompt, calls the AI gateway,
post-processes, persists, and returns the response envelope."""
import uuid

from ..ai import prompts
from ..ai.client import run_analysis
from ..images import ProcessedImage
from .. import schemas as s
from .. import storage
from .planning_math import finalise_planning
from .weather import fetch_forecast


def _finish(kind, result, mode, model, images, context, analysis_id) -> dict:
    urls = storage.save_images(analysis_id, images) if images else []
    row = storage.save_analysis(kind, mode, model, urls, context, result.model_dump(), analysis_id)
    return row


def _go(kind, schema, system, text, images, context):
    analysis_id = uuid.uuid4().hex
    result, mode, model = run_analysis(kind=kind, schema=schema, system=system, user_text=text,
                                       images=images, context=context)
    return result, mode, model, analysis_id


def safety(images: list[ProcessedImage], notes: str, site_type: str) -> dict:
    ctx = {"notes": notes, "site_type": site_type}
    text = f"Site type: {site_type or 'unspecified'}\nNotes from the site team: {notes or 'none'}\nAnalyse the photo(s) for safety."
    result, mode, model, aid = _go("safety", s.SafetyReport, prompts.SAFETY, text, images, ctx)
    return _finish("safety", result, mode, model, images, ctx, aid)


def cracks(images: list[ProcessedImage], notes: str, element: str) -> dict:
    ctx = {"notes": notes, "element": element}
    text = f"Structural element: {element or 'unspecified'}\nNotes: {notes or 'none'}\nAnalyse the cracks in the photo(s)."
    result, mode, model, aid = _go("cracks", s.CrackReport, prompts.CRACKS, text, images, ctx)
    return _finish("cracks", result, mode, model, images, ctx, aid)


def valuation(images: list[ProcessedImage], ctx: dict) -> dict:
    lines = "\n".join(f"- {k.replace('_', ' ')}: {v}" for k, v in ctx.items() if v not in (None, ""))
    text = f"Property details:\n{lines}\nProduce the valuation. {'Use the photos to judge condition.' if images else 'No photos provided.'}"
    result, mode, model, aid = _go("valuation", s.ValuationReport, prompts.VALUATION, text, images, ctx)
    return _finish("valuation", result, mode, model, images, ctx, aid)


def planning(images: list[ProcessedImage], ctx: dict) -> dict:
    lines = "\n".join(f"- {k.replace('_', ' ')}: {v}" for k, v in ctx.items() if v not in (None, ""))
    text = f"Project brief:\n{lines}\nProduce the full plan."
    result, mode, model, aid = _go("planning", s.PlanningReport, prompts.PLANNING, text, images, ctx)
    result = finalise_planning(result)
    return _finish("planning", result, mode, model, images, ctx, aid)


def assistant(images: list[ProcessedImage], location: str, activities: list[str], notes: str) -> dict:
    weather = fetch_forecast(location) if location else None
    ctx = {"location": location, "activities": activities, "notes": notes, "weather": weather or {}}
    forecast = "\n".join(
        f"- {d['date']}: {d['summary']}, {d['temp_min_c']}-{d['temp_max_c']} C, rain {d['precipitation_mm']} mm, wind up to {d['wind_max_kmh']} km/h"
        for d in (weather or {}).get("days", [])) or "Forecast unavailable."
    text = (f"Location: {location or 'unspecified'}\nForecast:\n{forecast}\n"
            f"Planned activities today: {', '.join(activities) or 'general site work'}\nNotes: {notes or 'none'}")
    result, mode, model, aid = _go("assistant", s.DailyBriefing, prompts.ASSISTANT, text, images, ctx)
    return _finish("assistant", result, mode, model, images, ctx, aid)


def knowledge(messages: list[dict]) -> dict:
    """Conversation history is rendered into one prompt so the schema-constrained answer
    always comes back in the same JSON shape."""
    question = messages[-1]["content"]
    history = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages[:-1][-8:])
    text = (f"Conversation so far:\n{history}\n\n" if history else "") + f"Question: {question}"
    ctx = {"question": question}
    result, mode, model, aid = _go("knowledge", s.KnowledgeAnswer, prompts.KNOWLEDGE, text, [], ctx)
    return _finish("knowledge", result, mode, model, [], ctx, aid)
