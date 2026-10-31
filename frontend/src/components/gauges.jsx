import { useEffect, useState } from "react";
import { cap } from "./testRuns.js";

export const SEVERITIES = ["minor", "moderate", "severe"];

export function Ring({ value, tone }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(id); }, [value]);
  const R = 42, C = 2 * Math.PI * R;
  return (
    <div className={`ring ${tone}`} role="img" aria-label={`Risk score ${value} out of 100`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} className="ring-bg" />
        <circle cx="50" cy="50" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} transform="rotate(-90 50 50)" />
      </svg>
      <b>{value}</b><small>of 100</small>
    </div>
  );
}

export function SeverityTrack({ value }) {
  const at = SEVERITIES.indexOf(value);
  return (
    <div className="sev-track" role="img" aria-label={`Severity: ${value}`}>
      {SEVERITIES.map((s, i) => <span key={s} className={i <= at ? `on t${at}` : ""}>{cap(s)}</span>)}
    </div>
  );
}

