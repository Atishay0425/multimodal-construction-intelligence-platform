import { useEffect, useState } from "react";

/** Loads the committed test runs (photo metadata + the saved AI report) from /testing. */
export function useTestRuns() {
  const [runs, setRuns] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const manifest = await (await fetch("/testing/manifest.json")).json();
        const all = await Promise.all(manifest.map(async (m) => {
          try { return { ...m, ...(await (await fetch(`/testing/${m.slug}.json`)).json()) }; } catch { return null; }
        }));
        if (live) setRuns(all.filter(Boolean));
      } catch {
        if (live) setRuns([]);
      }
    })();
    return () => { live = false; };
  }, []);
  return runs;
}

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ") : "");

/** One-line outcome, e.g. "Critical risk, 95 out of 100" or "Severe crack". */
export function outcome(run) {
  const r = run.envelope.result;
  return run.envelope.kind === "safety"
    ? `${cap(r.overall_risk)} risk, ${r.risk_score} out of 100`
    : `${cap(r.overall_severity)} crack`;
}

/** Did the analysis find what a person looking at the photo can plainly see? */
export function verdict(run) {
  const r = run.envelope.result;
  const found = r.findings ?? [];
  switch (run.slug) {
    case "fall-protection": {
      const f = found.find((x) => x.category === "fall_protection");
      return { pass: !!f, text: f ? `Found a ${f.severity} fall-protection hazard.` : "No fall-protection finding." };
    }
    case "scaffolding": {
      const f = found.find((x) => x.category === "scaffolding");
      return { pass: !!f, text: f ? `Found a ${f.severity} scaffolding hazard.` : "No scaffolding finding." };
    }
    case "workers-building":
      return { pass: found.length > 0, text: `Found ${found.length} hazard${found.length === 1 ? "" : "s"}.` };
    default:
      return { pass: !!r.cracks_detected && found.length > 0, text: r.cracks_detected ? `Found ${found.length} crack${found.length === 1 ? "" : "s"}.` : "No crack detected." };
  }
}
