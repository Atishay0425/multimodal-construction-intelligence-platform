"""Recompute every derived number in a planning report so totals and dates are always consistent,
no matter what the model (or demo mock) returned."""
from ..schemas import PlanningReport


def normalise_schedule(tasks):
    by_id = {t.id: t for t in tasks}
    for t in tasks:
        t.duration_days = max(1, t.duration_days)
        t.depends_on = [d for d in dict.fromkeys(t.depends_on) if d in by_id and d != t.id]

    start: dict[str, int] = {}
    visiting: set[str] = set()

    def resolve(tid: str) -> int:
        if tid in start:
            return start[tid]
        visiting.add(tid)
        t = by_id[tid]
        # Drop dependencies that would create a cycle.
        t.depends_on = [d for d in t.depends_on if d not in visiting]
        s = max((resolve(d) + by_id[d].duration_days for d in t.depends_on), default=0)
        visiting.discard(tid)
        start[tid] = s
        return s

    for t in tasks:
        t.start_day = resolve(t.id)
    return max((t.start_day + t.duration_days for t in tasks), default=0)


def finalise_planning(report: PlanningReport) -> PlanningReport:
    for m in report.materials:
        m.total_cost = round(m.quantity * m.unit_cost, 2)
    cs = report.cost_summary
    cs.materials_total = round(sum(m.total_cost for m in report.materials), 2)
    cs.grand_total = round(cs.materials_total + cs.labour_total + cs.equipment_total + cs.contingency, 2)
    report.total_duration_days = normalise_schedule(report.schedule)
    return report
