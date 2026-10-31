import { useRef, useState } from "react";
import { Badge } from "./ui.jsx";
import { cap } from "./testRuns.js";

const PHASES = [["Foundation", 0, 22], ["Structure", 18, 52], ["Masonry", 44, 70], ["Services", 56, 84], ["Finishing", 74, 100]];

function SafetyPreview({ runs }) {
  const run = runs?.find((r) => r.slug === "scaffolding");
  const found = run?.envelope.result.findings.slice(0, 3) ?? [];
  return (
    <div className="pv-stack">
      {run && <img className="pv-photo" src={run.file} alt="" />}
      <div className="pv-list">
        {found.map((f, i) => (
          <div key={i} className="pv-row" style={{ "--i": i }}>
            <Badge value={f.severity} /><span><b>{cap(f.category)}</b>{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function CracksPreview({ runs }) {
  const run = runs?.find((r) => r.slug === "retaining-wall-crack");
  const f = run?.envelope.result.findings[0];
  return (
    <div className="pv-stack">
      {run && <div className="pv-photo tall"><img src={run.file} alt="" /><i className="pv-pin" /></div>}
      <div className="pv-list">
        <div className="pv-row" style={{ "--i": 0 }}><Badge value="severe" /><span><b>Type</b>{cap(f?.crack_type)}, {f?.orientation}</span></div>
        <div className="pv-row" style={{ "--i": 1 }}><Badge value="muted">Cause</Badge><span><b>Likely</b>{f?.probable_causes?.[0] ?? "Differential settlement"}</span></div>
        <div className="pv-row" style={{ "--i": 2 }}><Badge value="ok">Repair</Badge><span><b>Next</b>{f?.recommended_actions?.[0] ?? "Monitor with crack gauges."}</span></div>
      </div>
    </div>
  );
}
function PlanningPreview() {
  return (
    <div className="pv-plan">
      <div className="pv-kpis"><div><small>Estimate</small><b>₹ 48 lakh</b></div><div><small>Duration</small><b>9 months</b></div><div><small>Floors</small><b>2</b></div></div>
      {PHASES.map(([name, a, b], i) => (
        <div className="pv-gantt" key={name}><span>{name}</span><div><i style={{ left: `${a}%`, width: `${b - a}%`, "--i": i }} /></div></div>
      ))}
    </div>
  );
}
function ValuationPreview() {
  return (
    <div className="pv-val">
      <small>Indicative range</small>
      <b>₹ 82 L to ₹ 96 L</b>
      <div className="pv-range"><i className="fill" /><i className="knob" /></div>
      <div className="pv-ends"><span>Low ₹ 82 L</span><span>High ₹ 96 L</span></div>
      <p>Based on location, area, age, condition and nearby listings, with the reasoning shown.</p>
    </div>
  );
}
function BriefingPreview() {
  return (
    <div className="pv-brief">
      <div className="pv-days">{[["Today", "32°", "Dry"], ["Tue", "29°", "Showers"], ["Wed", "31°", "Dry"]].map(([d, t, s]) => <div key={d}><small>{d}</small><b>{t}</b><span>{s}</span></div>)}</div>
      {[["Slab concreting", "go", "Go"], ["Crane lift", "hold", "Hold: wind 38 km/h"], ["Bar bending", "proceed_with_caution", "Caution: heat"]].map(([a, tone, label], i) => (
        <div className="pv-row" key={a} style={{ "--i": i }}><Badge value={tone}>{label}</Badge><span><b>{a}</b></span></div>
      ))}
    </div>
  );
}
function AskPreview() {
  return (
    <div className="pv-chat">
      <div className="bubble user" style={{ "--i": 0 }}>How long should I cure an M25 slab in hot weather?</div>
      <div className="bubble assistant typing" style={{ "--i": 1 }}><i /><i /><i /></div>
      <div className="bubble assistant" style={{ "--i": 2 }}>Keep it continuously wet for at least 10 days in hot weather, as IS 456 asks. Start as soon as the surface can take it without marring.</div>
    </div>
  );
}

const TOOLS = [
  { id: "safety", title: "Site safety", line: "Hazards ranked by severity, PPE checked, fixes listed.", View: SafetyPreview, real: true },
  { id: "cracks", title: "Crack analysis", line: "Type, likely cause, severity and a repair plan.", View: CracksPreview, real: true },
  { id: "planning", title: "Project planning", line: "Cost, materials, schedule and a floor plan.", View: PlanningPreview },
  { id: "valuation", title: "Property valuation", line: "An indicative range with the reasoning.", View: ValuationPreview },
  { id: "assistant", title: "Daily briefing", line: "The forecast turned into go or hold for each job.", View: BriefingPreview },
  { id: "knowledge", title: "Ask a question", line: "Answers that name the standard they rely on.", View: AskPreview },
];

export default function ToolShowcase({ runs }) {
  const [sel, setSel] = useState(0);
  const tabs = useRef([]);
  const tool = TOOLS[sel];
  const onKey = (e) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (sel + d + TOOLS.length) % TOOLS.length;
    setSel(n); tabs.current[n]?.focus();
  };
  return (
    <div className="showcase">
      <div className="sc-tabs" role="tablist" aria-label="Tools" aria-orientation="vertical" onKeyDown={onKey}>
        {TOOLS.map((t, i) => (
          <button type="button" role="tab" id={`tool-tab-${t.id}`} aria-controls="tool-panel" key={t.id} ref={(el) => (tabs.current[i] = el)}
                  aria-selected={i === sel} tabIndex={i === sel ? 0 : -1} className={i === sel ? "on" : ""} onClick={() => setSel(i)}>
            <b>{t.title}</b><span>{t.line}</span>
          </button>
        ))}
      </div>
      <div className="sc-panel" role="tabpanel" id="tool-panel" aria-labelledby={`tool-tab-${tool.id}`}>
        <div className="sc-view" key={tool.id}>
          <tool.View runs={runs} />
        </div>
        <div className="sc-foot">
          <span className="meta-line">{tool.real ? "From a real test run" : "Example output"}</span>
          <a className="btn primary" href={`#${tool.id}`}>Open {tool.title.toLowerCase()}</a>
        </div>
      </div>
    </div>
  );
}
