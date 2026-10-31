import { useEffect, useState } from "react";
import { getHealth, getHistory } from "../api.js";
import { PageHeader } from "../components/ui.jsx";

export const MODULES = [
  { id: "safety", icon: "🦺", title: "Site Safety", text: "PPE and hazard detection from site photos." },
  { id: "cracks", icon: "🧱", title: "Crack Analysis", text: "Classify cracks, severity and causes." },
  { id: "valuation", icon: "🏠", title: "Valuation", text: "Indicative real-estate value." },
  { id: "planning", icon: "📐", title: "Planning", text: "Materials, cost, schedule, concept." },
  { id: "assistant", icon: "⛅", title: "Daily Assistant", text: "Weather-aware go / no-go briefing." },
  { id: "knowledge", icon: "💬", title: "Knowledge Chat", text: "Codes, methods and best practice." },
];

export default function Dashboard({ go }) {
  const [health, setHealth] = useState(null);
  const [count, setCount] = useState(null);
  const [down, setDown] = useState(false);
  useEffect(() => {
    getHealth().then(setHealth).catch(() => setDown(true));
    getHistory().then((h) => setCount(h.length)).catch(() => {});
  }, []);
  return (
    <>
      <PageHeader title="Construction Intelligence Platform" subtitle="Multimodal AI for safety, structure, planning and valuation — text and images in, structured insight out." />
      <div className={`status ${down ? "bad" : health?.mode === "demo" ? "warn" : "ok"}`}>
        {down && "Backend not reachable on port 8000 — start it with the command in the README."}
        {health?.mode === "live" && `AI online · ${health.model}`}
        {health?.mode === "demo" && "Demo mode — add ANTHROPIC_API_KEY to backend/.env to enable live Claude analysis."}
        {!down && !health && "Checking backend…"}
        {count !== null && <span> · {count} saved analyses</span>}
      </div>
      <div className="module-grid">
        {MODULES.map((m) => (
          <button key={m.id} className="module" onClick={() => go(m.id)}>
            <span className="module-icon" aria-hidden>{m.icon}</span>
            <strong>{m.title}</strong>
            <small>{m.text}</small>
          </button>
        ))}
      </div>
    </>
  );
}
