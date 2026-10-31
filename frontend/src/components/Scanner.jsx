import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "./ui.jsx";
import { cap, outcome } from "./testRuns.js";
import { Ring, SeverityTrack } from "./gauges.jsx";
import { prefersReducedMotion } from "./motion.jsx";

// Where each finding sits in its photo, as % of the image (x, y). Placed by hand from the
// report's own "location" text, so the pins point at what the AI said, not at new detections.
const PINS = {
  "fall-protection": [[60, 46], [17, 48], [47, 12]],
  scaffolding: [[65, 35], [42, 50], [14, 24], [92, 60]],
  "workers-building": [[58, 39], [69, 82]],
  "wall-crack": [[45, 27]],
  "retaining-wall-crack": [[51, 54]],
};
const SIZE = { "fall-protection": [1024, 766], scaffolding: [1920, 1440], "workers-building": [1920, 1440], "wall-crack": [1346, 2048], "retaining-wall-crack": [1050, 1400] };
const TAB = { "fall-protection": "Steel frame", scaffolding: "Scaffolding", "workers-building": "Formwork", "wall-crack": "Facade crack", "retaining-wall-crack": "Retaining wall" };
const CYCLE_MS = 9000;

/** One shape for safety hazards and cracks. */
function toItems(run) {
  const r = run.envelope.result;
  return (r.findings ?? []).map((f, i) => run.envelope.kind === "safety"
    ? { title: cap(f.category), severity: f.severity, text: f.description, where: f.location_in_image, fix: f.corrective_action, at: PINS[run.slug]?.[i] }
    : {
        title: `${cap(f.orientation || f.crack_type)} crack`, severity: f.severity,
        text: `${cap(f.crack_type)} crack, about ${f.estimated_width_mm} mm wide (estimated, there is no scale in the photo).`,
        where: f.location, fix: f.recommended_actions?.[0], at: PINS[run.slug]?.[i],
      });
}

export default function Scanner({ runs }) {
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(() => !prefersReducedMotion());
  const [hover, setHover] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  // Only auto-advance while the photo is on screen, so it never changes under someone reading the report.
  const stage = useRef(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const running = auto && !hover && onScreen;
  const run = runs[idx];
  const items = useMemo(() => toItems(run), [run]);
  const kind = run.envelope.kind, res = run.envelope.result;
  const [w, h] = SIZE[run.slug] ?? [4, 3];

  const select = (i, manual) => {
    if (manual) setAuto(false);
    setIdx(i); setActive(0); setScanKey((k) => k + 1);
  };
  // Move on to the next photo until the visitor takes over.
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => select((idx + 1) % runs.length, false), CYCLE_MS);
    return () => clearTimeout(id);
  }, [running, idx, runs.length]);

  // Arrow keys move between photos when a tab has focus.
  const tabs = useRef([]);
  const onKey = (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (idx + d + runs.length) % runs.length;
    select(n, true);
    tabs.current[n]?.focus();
  };

  const top = items[active];
  return (
    <div className="scanner" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <div className="scan-stage" ref={stage} style={{ "--ratio": `${w} / ${h}`, "--rw": w, "--rh": h }}>
        <img className="scan-backdrop" src={run.file} alt="" aria-hidden="true" key={`b${run.slug}`} />
        <div className="scan-frame" key={`${run.slug}-${scanKey}`}>
          <img src={run.file} alt={run.label} width={w} height={h} fetchpriority={idx === 0 ? "high" : undefined} />
          <i className="scan-line" aria-hidden="true" />
          {items.map((it, i) => it.at && (
            <button
              type="button" key={i}
              className={`pin ${it.severity} ${i === active ? "on" : ""}`}
              style={{ left: `${it.at[0]}%`, top: `${it.at[1]}%`, "--i": i }}
              onClick={() => { setActive(i); setAuto(false); }}
              aria-label={`Finding ${i + 1}: ${it.title}, ${it.severity}`}
              aria-pressed={i === active}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="scan-chip"><Badge value="test">Test run</Badge><span>Real photo, real AI report</span></div>
        <div className="scan-model">Analysed by {run.envelope.model}</div>
      </div>

      <aside className="scan-panel" aria-live="polite">
        <div className="scan-head">
          {kind === "safety" ? <Ring value={res.risk_score} tone={res.overall_risk} /> : null}
          <div>
            <span className="scan-kind">{kind === "safety" ? "Site safety" : "Crack analysis"}</span>
            <strong>{kind === "safety" ? `${cap(res.overall_risk)} risk` : `${cap(res.overall_severity)} crack`}</strong>
            {kind === "cracks" && <SeverityTrack value={res.overall_severity} />}
          </div>
        </div>

        <ol className="scan-items">
          {items.map((it, i) => (
            <li key={`${run.slug}${i}`} className={i === active ? "on" : ""} style={{ "--i": i }}>
              <button type="button" onClick={() => { setActive(i); setAuto(false); }} aria-expanded={i === active}>
                <span className={`dot ${it.severity}`}>{i + 1}</span>
                <span className="it-main">
                  <span className="it-top"><b>{it.title}</b><Badge value={it.severity} /></span>
                  <span className="it-text">{it.text}</span>
                </span>
              </button>
              <div className="it-more"><div>
                {it.where && <p><b>Where</b>{it.where}</p>}
                {it.fix && <p><b>Fix</b>{it.fix}</p>}
              </div></div>
            </li>
          ))}
        </ol>
        <a className="chev scan-more" href={`#testing/${run.slug}`}>Read the full report</a>
      </aside>

      <div className="scan-tabs" role="tablist" aria-label="Test photos" onKeyDown={onKey}>
        {runs.map((r, i) => (
          <button
            type="button" role="tab" key={r.slug} ref={(el) => (tabs.current[i] = el)}
            aria-selected={i === idx} tabIndex={i === idx ? 0 : -1}
            className={i === idx ? "on" : ""} onClick={() => select(i, true)}
          >
            <img src={r.file} alt="" loading={i === 0 ? "eager" : "lazy"} />
            <span>{TAB[r.slug] ?? r.label}<small>{outcome(r)}</small></span>
            {i === idx && running && <i className="timer" style={{ animationDuration: `${CYCLE_MS}ms` }} key={`t${idx}${scanKey}`} />}
          </button>
        ))}
      </div>
      <p className="scan-note">{top ? "Pins show where the report says each issue is. " : ""}Tap a photo to scan it. These are saved results from the live AI, so nothing here costs a request.</p>
    </div>
  );
}
