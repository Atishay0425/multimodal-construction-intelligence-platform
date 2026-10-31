import { useEffect, useState } from "react";
import { getHistory } from "../api.js";
import { PageHeader } from "../components/ui.jsx";
import { KIND_LABEL } from "./HistoryPage.jsx";

const TOOLS = [
  { group: "Inspect", items: [
    { id: "safety", title: "Site safety", give: "Site photos", get: "Hazards ranked by severity, PPE check, what to fix first" },
    { id: "cracks", title: "Crack analysis", give: "Photos of a crack", get: "Crack type, likely cause, severity and repair steps" },
  ] },
  { group: "Plan", items: [
    { id: "planning", title: "Project planning", give: "A short building brief", get: "Cost estimate, material list, schedule and floor plan" },
    { id: "valuation", title: "Property valuation", give: "Property details, photos optional", get: "Indicative price range with the reasoning" },
  ] },
  { group: "On site", items: [
    { id: "assistant", title: "Daily briefing", give: "Site location and today's work", get: "Go or hold for each activity, based on the forecast" },
    { id: "knowledge", title: "Ask a question", give: "Any construction question", get: "A direct answer with code references" },
  ] },
];

export default function Dashboard({ go, health }) {
  const [recent, setRecent] = useState(null);
  useEffect(() => {
    getHistory().then((h) => setRecent(h.slice(0, 6))).catch(() => setRecent([]));
  }, []);
  return (
    <>
      <PageHeader title="What's on site today?"
                  subtitle="Pick a tool, give it photos or a few details, and get a structured report you can print or share." />
      {health?.mode === "demo" && (
        <div className="alert warn">
          Demo mode: every tool returns a sample report. Add <code>GEMINI_API_KEY</code> (free) or{" "}
          <code>ANTHROPIC_API_KEY</code> to the server settings for real analysis.
        </div>
      )}
      <div className="overview">
        <div className="card tool-list" style={{ padding: 0 }}>
          {TOOLS.map((g) => (
            <div key={g.group}>
              <div className="tool-group">{g.group}</div>
              {g.items.map((t) => (
                <button type="button" key={t.id} className="tool" onClick={() => go(t.id)}>
                  <strong>{t.title}</strong>
                  <span><em>You give</em>{t.give}</span>
                  <span><em>You get</em>{t.get}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <aside className="card recent" aria-label="Recent reports">
          <h2>Recent reports</h2>
          {recent === null && <p className="muted-text">Loading…</p>}
          {recent?.length === 0 && <p className="muted-text">No reports yet. Run any tool and it appears here.</p>}
          {recent?.map((r) => (
            <a key={r.id} href={`#history/${r.id}`}>
              <strong>{KIND_LABEL[r.kind]}</strong>
              <span>{new Date(r.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </a>
          ))}
          {recent?.length > 0 && <a className="all" href="#history">All saved reports</a>}
        </aside>
      </div>
    </>
  );
}
