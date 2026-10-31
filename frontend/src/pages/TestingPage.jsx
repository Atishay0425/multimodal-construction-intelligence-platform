import { useEffect, useState } from "react";
import { Badge, PageHeader } from "../components/ui.jsx";
import { CrackResult, SafetyResult } from "../components/Results.jsx";
import { outcome, useTestRuns, verdict } from "../components/testRuns.js";

export default function TestingPage({ param }) {
  const runs = useTestRuns();
  const [suite, setSuite] = useState(null);
  const [open, setOpen] = useState(param || null); // #testing/<slug> opens that report
  useEffect(() => { if (param) setOpen(param); }, [param]);
  useEffect(() => {
    let live = true;
    fetch("/testing/suite.json").then((r) => r.json()).then((s) => live && setSuite(s)).catch(() => {});
    return () => { live = false; };
  }, []);
  const passed = runs?.filter((r) => verdict(r).pass).length ?? 0;
  // A link like #testing/wall-crack lists that test first.
  const ordered = runs && param ? [...runs].sort((a, b) => (a.slug === param ? -1 : b.slug === param ? 1 : 0)) : runs;

  return (
    <>
      <PageHeader title="Testing" subtitle="Real site photos run through the same analysis you use, and the automated checks behind it." />

      <h2 className="section-title" style={{ marginTop: 0 }}>Real site photos</h2>
      <p className="section-lead">
        Open-licensed photos from Wikimedia Commons. A test passes when the report contains what a person can plainly see in the photo.
        It doesn't prove a severity or a width is right; only an engineer on site can do that.
      </p>
      {runs === null && <p className="muted-text" style={{ textAlign: "center" }}>Loading test results…</p>}
      {runs?.length === 0 && <div className="alert warn">The saved test results couldn't be loaded.</div>}
      {runs?.length > 0 && (
        <p className="section-lead" style={{ marginTop: -12 }}><b>{passed} of {runs.length}</b> photo tests passed.</p>
      )}

      {ordered?.map((r) => {
        const env = r.envelope, res = env.result, v = verdict(r), isOpen = open === r.slug;
        return (
          <div key={r.slug}>
            <article className="test-card">
              <img src={r.file} alt={r.label} loading="lazy" />
              <div className="test-body">
                <div className="row"><Badge value="test">Test run</Badge><span className="meta-line">{env.kind === "safety" ? "Site safety" : "Crack analysis"}</span></div>
                <h2>{r.label}</h2>
                <div className="row">
                  <Badge value={env.kind === "safety" ? res.overall_risk : res.overall_severity}>{outcome(r)}</Badge>
                  <span className="meta-line">Analysed by {env.model}</span>
                </div>
                <p>{res.summary}</p>
                <div className={`verdict ${v.pass ? "pass" : "fail"}`}>
                  <span className="tick" aria-hidden="true">{v.pass ? "✓" : "✕"}</span>
                  <span className="sr-only">{v.pass ? "Passed. " : "Failed. "}</span>
                  <span><b>{r.expect}.</b> {v.text}</span>
                </div>
                {env.kind === "cracks" && (
                  <p className="meta-line">There's no ruler or coin in this photo, so the width is a rough estimate. Treat the severity as a reason for an engineer to look, not a measurement.</p>
                )}
                <div className="test-actions">
                  <button type="button" className="btn small primary" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.slug)}>
                    {isOpen ? "Hide full report" : "View full report"}
                  </button>
                </div>
                <p className="credit">
                  Photo: "{r.title}" by {r.author}, {r.license}, via <a href={r.source}>Wikimedia Commons</a>.
                </p>
              </div>
            </article>
            {isOpen && <div className="expand">{env.kind === "safety" ? <SafetyResult data={env} /> : <CrackResult data={env} />}</div>}
          </div>
        );
      })}

      {suite && (
        <>
          <h2 className="section-title">Automated checks</h2>
          <p className="section-lead">
            {suite.passed} of {suite.total} backend tests passed on {new Date(suite.date).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.
            Run them yourself with <code>cd backend && python -m pytest</code>.
          </p>
          <div className="suite">
            {suite.groups.map((g) => (
              <div className="suite-row" key={g.area}>
                <strong>{g.area}</strong>
                <b>{g.count} tests</b>
                <span>{g.covers}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
