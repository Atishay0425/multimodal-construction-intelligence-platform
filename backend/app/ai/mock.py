"""Deterministic demo responses used when no ANTHROPIC_API_KEY is configured.

They match the real schemas exactly so the UI and tests behave identically in both modes.
"""
from .. import schemas as s


def safety(ctx: dict, n_images: int) -> s.SafetyReport:
    return s.SafetyReport(
        summary="DEMO: Two workers on an upper slab edge without visible fall protection; one without a hard hat. Loose formwork timber on the walkway.",
        overall_risk="high", risk_score=72,
        ppe=s.PPEAssessment(workers_visible=2, hard_hat="some", high_vis_vest="all",
                            gloves_and_footwear="not_assessable",
                            notes="One worker at left appears bare-headed; footwear not visible."),
        findings=[
            s.SafetyFinding(category="fall_protection", severity="critical",
                            description="Unprotected slab edge with no guardrail, netting or visible harness anchor.",
                            location_in_image="Upper right, slab edge",
                            corrective_action="Stop edge work; install guardrails or safety netting and require harness tie-off."),
            s.SafetyFinding(category="ppe", severity="high",
                            description="Worker without a hard hat in an overhead-hazard zone.",
                            location_in_image="Left foreground",
                            corrective_action="Issue a hard hat immediately and brief the crew on mandatory PPE zones."),
            s.SafetyFinding(category="housekeeping", severity="medium",
                            description="Loose timber and offcuts on the access path create trip hazards.",
                            location_in_image="Bottom centre",
                            corrective_action="Clear and stack materials; assign a daily housekeeping owner."),
        ],
        immediate_actions=["Halt work at the unprotected edge", "Provide hard hat to bare-headed worker",
                           "Clear the access path of debris"],
        image_quality_note="Demo data - no real image analysis was performed.",
        confidence="medium",
    )


def cracks(ctx: dict, n_images: int) -> s.CrackReport:
    return s.CrackReport(
        summary="DEMO: A diagonal stair-step crack in masonry plus fine vertical hairline cracking in plaster.",
        cracks_detected=True, overall_severity="moderate", requires_structural_engineer=True,
        findings=[
            s.CrackFinding(crack_type="diagonal", location="Wall panel near the window corner",
                           orientation="diagonal", estimated_width_mm=2.5, severity="moderate",
                           probable_causes=["Differential settlement of the foundation", "Stress concentration at opening corner"],
                           recommended_actions=["Install tell-tale gauges", "Have a structural engineer inspect the footing",
                                                "Do not patch until movement is understood"]),
            s.CrackFinding(crack_type="hairline", location="Plaster, lower right",
                           orientation="vertical", estimated_width_mm=0.3, severity="minor",
                           probable_causes=["Plaster shrinkage during curing"],
                           recommended_actions=["Monitor", "Fill with flexible filler and repaint"]),
        ],
        monitoring_plan="Photograph weekly with a scale card, fix crack gauges across the diagonal crack and log width monthly.",
        limitations="Demo data - width estimates are illustrative only.",
        confidence="medium",
    )


def valuation(ctx: dict, n_images: int) -> s.ValuationReport:
    area = float(ctx.get("area_sqft") or 1000)
    currency = ctx.get("currency") or "INR"
    base_psf = {"INR": 7500, "USD": 220, "EUR": 200, "GBP": 190, "AED": 900}.get(currency, 100)
    cond = {"excellent": 1.12, "good": 1.0, "average": 0.92, "poor": 0.78}.get(ctx.get("condition", "good"), 1.0)
    age_adj = max(0.7, 1 - 0.01 * float(ctx.get("age_years") or 0))
    psf = round(base_psf * cond * age_adj)
    est = round(psf * area)
    return s.ValuationReport(
        currency=currency, estimated_value=est, low_estimate=round(est * 0.9), high_estimate=round(est * 1.1),
        price_per_sqft=psf,
        condition_assessment=f"DEMO: Treated as '{ctx.get('condition', 'good')}' condition, {ctx.get('age_years', 0)} years old.",
        value_drivers=["Location and connectivity", "Built-up area", "Amenities provided"],
        risk_factors=["Estimate uses generic demo rates, not live comparables", "Condition judged from limited inputs"],
        methodology="Demo: price-per-sqft baseline adjusted for condition and age. Live mode uses Claude with local market knowledge and photos.",
        confidence="low",
        disclaimer="Indicative estimate only - not a certified appraisal.",
    )


def planning(ctx: dict, n_images: int) -> s.PlanningReport:
    area = float(ctx.get("built_up_area_sqm") or 200)
    floors = max(1, int(ctx.get("floors") or 1))
    currency = ctx.get("currency") or "INR"
    k = {"INR": 1.0, "USD": 0.012, "EUR": 0.011, "GBP": 0.0095}.get(currency, 1.0)
    mats = [
        ("Cement (OPC 43)", "bag", area * 6.5, 400 * k),
        ("Steel reinforcement (TMT)", "kg", area * 38, 70 * k),
        ("Bricks / blocks", "nos", area * 55, 9 * k),
        ("River/M-sand", "m3", area * 0.9, 1800 * k),
        ("Aggregate 20mm", "m3", area * 0.8, 1600 * k),
        ("Flooring tiles", "m2", area * 0.9, 650 * k),
        ("Paint and putty", "litre", area * 1.2, 350 * k),
    ]
    materials = [s.MaterialLine(item=i, unit=u, quantity=round(q, 1), unit_cost=round(c, 2), total_cost=0) for i, u, q, c in mats]
    mt = sum(m.quantity * m.unit_cost for m in materials)
    tasks = [
        ("T1", "Site clearing and surveying", "Preparation", 5, []),
        ("T2", "Excavation and footing", "Foundation", 12, ["T1"]),
        ("T3", "Plinth and damp-proofing", "Foundation", 8, ["T2"]),
        ("T4", "Columns, beams and slabs", "Structure", 25 * floors, ["T3"]),
        ("T5", "Masonry walls", "Structure", 18 * floors, ["T4"]),
        ("T6", "Electrical and plumbing rough-in", "MEP", 14, ["T5"]),
        ("T7", "Plastering", "Finishes", 15, ["T6"]),
        ("T8", "Flooring and tiling", "Finishes", 14, ["T7"]),
        ("T9", "Painting and fixtures", "Finishes", 12, ["T8"]),
        ("T10", "Final inspection and handover", "Closeout", 4, ["T9"]),
    ]
    sched = [s.ScheduleTask(id=i, name=n, phase=p, duration_days=d, depends_on=dep, start_day=0) for i, n, p, d, dep in tasks]
    rooms = [("Living room", 5.0, 4.5), ("Kitchen", 3.5, 3.0), ("Bedroom 1", 4.0, 3.5),
             ("Bedroom 2", 3.5, 3.5), ("Bathroom", 2.5, 2.0), ("Utility", 2.0, 2.0)]
    return s.PlanningReport(
        summary=f"DEMO plan for a {floors}-floor, {area:.0f} sqm building.",
        materials=materials,
        cost_summary=s.CostSummary(currency=currency, materials_total=mt, labour_total=mt * 0.6,
                                   equipment_total=mt * 0.12, contingency=mt * 0.1, grand_total=0),
        schedule=sched, total_duration_days=0,
        architecture=s.ArchitecturalConcept(
            style="Contemporary, simple massing with cross-ventilation",
            description="Compact rectangular footprint with the living and kitchen zones on the entry side and bedrooms at the rear for privacy.",
            rooms=[s.RoomSpec(name=n, floor=0, width_m=w, length_m=l) for n, w, l in rooms],
            key_features=["Cross ventilation", "Rainwater harvesting", "Solar-ready roof"]),
        assumptions=["Demo unit rates, not live market prices", "Standard soil conditions"],
        risks=["Monsoon delays to foundation work", "Material price volatility"],
    )


def assistant(ctx: dict, n_images: int) -> s.DailyBriefing:
    rainy = any((d.get("precipitation_mm") or 0) > 5 for d in ctx.get("weather", {}).get("days", [])[:1])
    return s.DailyBriefing(
        summary="DEMO: " + ("Rain expected today - protect concrete work and defer roofing." if rainy
                            else "Conditions look workable; keep normal heat and hydration controls."),
        decision="proceed_with_caution" if rainy else "go",
        activity_impacts=[s.ActivityImpact(activity=a, impact="minor" if rainy else "none",
                                           recommendation="Cover freshly placed work and re-check at midday." if rainy else "Proceed as planned.")
                          for a in (ctx.get("activities") or ["General site work"])[:6]],
        safety_reminders=["Toolbox talk at start of shift", "Check scaffolds and edge protection after wind or rain"],
        suggested_schedule=[s.ScheduleSlot(time="07:00", task="Toolbox talk and inspections"),
                            s.ScheduleSlot(time="08:00", task="Primary structural works"),
                            s.ScheduleSlot(time="13:00", task="Finishing and material staging")],
        material_handling_notes=["Keep cement bags off the ground and covered", "Cover sand and aggregate stockpiles"],
    )


def knowledge(ctx: dict, n_images: int) -> s.KnowledgeAnswer:
    q = ctx.get("question", "")
    return s.KnowledgeAnswer(
        answer=f"DEMO answer for: \"{q}\". Add an ANTHROPIC_API_KEY to the backend .env to get a real, model-generated answer.",
        key_points=["Demo mode returns placeholder content", "Live mode uses Claude with construction-specific guidance"],
        standards_referenced=["IS 456", "OSHA 1926"],
        follow_up_questions=["What grade of concrete suits this element?", "What curing period applies?"],
        disclaimer="Placeholder demo response.",
    )


MOCKS = {"safety": safety, "cracks": cracks, "valuation": valuation, "planning": planning,
         "assistant": assistant, "knowledge": knowledge}
