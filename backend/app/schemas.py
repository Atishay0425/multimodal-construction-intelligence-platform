"""Strict JSON contracts for every AI response.

These models are passed to Claude as the structured-output schema, so the model
must return exactly this shape and the frontend can render it without guards.
Avoid numeric constraints (ge/le) - structured outputs do not support them.
"""
from typing import Literal

from pydantic import BaseModel

Confidence = Literal["low", "medium", "high"]


# ---------- Safety monitoring ----------
class SafetyFinding(BaseModel):
    category: Literal[
        "ppe", "fall_protection", "housekeeping", "equipment",
        "electrical", "excavation", "fire", "scaffolding", "other",
    ]
    description: str
    severity: Literal["low", "medium", "high", "critical"]
    location_in_image: str
    corrective_action: str


class PPEAssessment(BaseModel):
    workers_visible: int
    hard_hat: Literal["all", "some", "none", "not_assessable"]
    high_vis_vest: Literal["all", "some", "none", "not_assessable"]
    gloves_and_footwear: Literal["all", "some", "none", "not_assessable"]
    notes: str


class SafetyReport(BaseModel):
    summary: str
    overall_risk: Literal["low", "medium", "high", "critical"]
    risk_score: int  # 0-100, higher is riskier
    ppe: PPEAssessment
    findings: list[SafetyFinding]
    immediate_actions: list[str]
    image_quality_note: str
    confidence: Confidence


# ---------- Crack detection ----------
class CrackFinding(BaseModel):
    crack_type: Literal[
        "hairline", "shrinkage", "settlement", "flexural", "shear",
        "thermal", "diagonal", "vertical", "horizontal", "map_cracking",
        "spalling", "other",
    ]
    location: str
    orientation: Literal["horizontal", "vertical", "diagonal", "random", "unclear"]
    estimated_width_mm: float  # visual estimate; 0 when it cannot be judged
    severity: Literal["minor", "moderate", "severe", "critical"]
    probable_causes: list[str]
    recommended_actions: list[str]


class CrackReport(BaseModel):
    summary: str
    cracks_detected: bool
    overall_severity: Literal["none", "minor", "moderate", "severe", "critical"]
    requires_structural_engineer: bool
    findings: list[CrackFinding]
    monitoring_plan: str
    limitations: str
    confidence: Confidence


# ---------- Real estate valuation ----------
class ValuationReport(BaseModel):
    currency: str
    estimated_value: float
    low_estimate: float
    high_estimate: float
    price_per_sqft: float
    condition_assessment: str
    value_drivers: list[str]
    risk_factors: list[str]
    methodology: str
    confidence: Confidence
    disclaimer: str


# ---------- Construction planning ----------
class MaterialLine(BaseModel):
    item: str
    unit: str
    quantity: float
    unit_cost: float
    total_cost: float  # recomputed server-side as quantity * unit_cost


class CostSummary(BaseModel):
    currency: str
    materials_total: float
    labour_total: float
    equipment_total: float
    contingency: float
    grand_total: float  # recomputed server-side


class ScheduleTask(BaseModel):
    id: str
    name: str
    phase: str
    duration_days: int
    depends_on: list[str]
    start_day: int  # recomputed server-side from dependencies


class RoomSpec(BaseModel):
    name: str
    floor: int
    width_m: float
    length_m: float


class ArchitecturalConcept(BaseModel):
    style: str
    description: str
    rooms: list[RoomSpec]
    key_features: list[str]


class PlanningReport(BaseModel):
    summary: str
    materials: list[MaterialLine]
    cost_summary: CostSummary
    schedule: list[ScheduleTask]
    total_duration_days: int  # recomputed server-side
    architecture: ArchitecturalConcept
    assumptions: list[str]
    risks: list[str]


# ---------- Daily site assistant ----------
class WeatherDay(BaseModel):
    date: str
    temp_max_c: float
    temp_min_c: float
    precipitation_mm: float
    wind_max_kmh: float
    summary: str


class ActivityImpact(BaseModel):
    activity: str
    impact: Literal["none", "minor", "major", "stop_work"]
    recommendation: str


class ScheduleSlot(BaseModel):
    time: str
    task: str


class DailyBriefing(BaseModel):
    summary: str
    decision: Literal["go", "proceed_with_caution", "hold"]
    activity_impacts: list[ActivityImpact]
    safety_reminders: list[str]
    suggested_schedule: list[ScheduleSlot]
    material_handling_notes: list[str]


# ---------- Knowledge assistant ----------
class KnowledgeAnswer(BaseModel):
    answer: str
    key_points: list[str]
    standards_referenced: list[str]
    follow_up_questions: list[str]
    disclaimer: str


# ---------- Envelope returned by every endpoint ----------
class Envelope(BaseModel):
    id: str
    kind: str
    mode: Literal["live", "demo"]
    model: str
    created_at: str
    image_urls: list[str]
    result: dict
    context: dict
