import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion.jsx";

const ICONS = {
  safety: <><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m8.8 12 2.4 2.4 4.2-4.6" /></>,
  cracks: <><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="m13 4-2 5 3 2-3 4 2 5" /></>,
  planning: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M3.5 9.5h17M9.5 9.5v11" /></>,
  valuation: <><path d="M3.5 11 12 4l8.5 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  assistant: <><circle cx="8.5" cy="8.5" r="3" /><path d="M8.5 2.5v1.2M2.5 8.5h1.2M4.3 4.3l.9.9M12.7 4.3l-.9.9" /><path d="M8 19.5h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.4 1.2A3 3 0 0 0 8 19.5Z" /></>,
  knowledge: <><path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.5 20.5l1.4-5A8 8 0 1 1 20.5 12Z" /><path d="M9 11h6M9 14h3.5" /></>,
  history: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  testing: <><path d="M9 3.5h6M10 3.5v6L5 18.5a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9v-6" /><path d="M8 15h8" /></>,
};

export const TOOL_META = {
  safety: { a: ["#ff9500", "#ff3b30"], gets: ["Hazards ranked", "PPE check", "Fix-first list"], steps: ["Reading your photos", "Looking for hazards", "Checking PPE", "Ranking by severity", "Writing the report"] },
  cracks: { a: ["#bf5af2", "#5e5ce6"], gets: ["Crack type", "Likely cause", "Repair steps"], steps: ["Reading your photos", "Tracing the cracks", "Judging width and pattern", "Working out likely causes", "Writing the report"] },
  planning: { a: ["#0a84ff", "#5e5ce6"], gets: ["Cost estimate", "Material list", "Schedule and plan"], steps: ["Reading your brief", "Sizing the structure", "Pricing materials and labour", "Sequencing the schedule", "Drawing the floor plan"] },
  valuation: { a: ["#30b350", "#00a6a6"], gets: ["Price range", "Value drivers", "Risk factors"], steps: ["Reading the details", "Comparing similar properties", "Adjusting for condition and age", "Settling on a range"] },
  assistant: { a: ["#5ac8fa", "#0a84ff"], gets: ["Live forecast", "Go or hold", "Day schedule"], steps: ["Fetching the forecast", "Checking each activity", "Planning the day", "Writing the briefing"] },
  knowledge: { a: ["#ff6482", "#bf5af2"], gets: ["Plain answers", "Standards cited", "Key points"] },
  history: { a: ["#8e8e93", "#48484a"], gets: ["Every report", "Print or download", "Delete any time"] },
  testing: { a: ["#34c759", "#0a84ff"], gets: ["Real photos", "Pass or fail", "51 automated tests"] },
};

export function ToolIcon({ id, size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[id]}
    </svg>
  );
}

/** The coloured icon tile used in page headers, report cards and chat. */
export function ToolTile({ id, size = 56 }) {
  const m = TOOL_META[id];
  return (
    <span className="tool-tile" style={{ "--a1": m.a[0], "--a2": m.a[1], width: size, height: size, borderRadius: size * 0.3 }}>
      <ToolIcon id={id} size={size * 0.5} />
    </span>
  );
}

/** Scrolls its content into view once, when it first appears (a new result or the loading scene). */
export function ScrollIntoView({ children, block = "start" }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block });
  }, [block]);
  return <div ref={ref} className="scroll-anchor">{children}</div>;
}

/** What the visitor watches while the AI works: their photo being scanned and the steps ticking off. */
export function AnalysisScene({ tool, files = [] }) {
  const steps = TOOL_META[tool].steps;
  const [at, setAt] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (at >= steps.length - 1) return;
    const t = setTimeout(() => setAt((a) => a + 1), 3800);
    return () => clearTimeout(t);
  }, [at, steps.length]);
  const url = useMemo(() => (files[0] ? URL.createObjectURL(files[0]) : null), [files]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <ScrollIntoView block="center">
      <section className="scene" role="status" aria-live="polite">
        <div className="scene-visual">
          {url ? <img src={url} alt="" /> : <ToolTile id={tool} size={84} />}
          <i className="scan-line" aria-hidden="true" />
          <span className="scene-corner tl" /><span className="scene-corner tr" /><span className="scene-corner bl" /><span className="scene-corner br" />
        </div>
        <div className="scene-steps">
          <h2>Working on it</h2>
          <ol>
            {steps.map((s, i) => (
              <li key={s} className={i < at ? "done" : i === at ? "now" : ""}>
                <span className="mark" aria-hidden="true">{i < at ? "✓" : ""}</span>{s}
              </li>
            ))}
          </ol>
          <div className="scene-foot"><span className="tape" aria-hidden="true" /><span>{secs} s. Usually under a minute.</span></div>
        </div>
      </section>
    </ScrollIntoView>
  );
}

/** Pill buttons that fill a form with a worked example. */
export function Presets({ items, onPick, label = "Start from an example" }) {
  return (
    <div className="presets">
      <span>{label}</span>
      <div>{items.map((p) => <button type="button" key={p.label} onClick={() => onPick(p)}>{p.label}</button>)}</div>
    </div>
  );
}
