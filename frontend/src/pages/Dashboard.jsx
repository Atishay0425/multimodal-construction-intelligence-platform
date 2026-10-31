import { useEffect, useState } from "react";
import Scanner from "../components/Scanner.jsx";
import ToolShowcase from "../components/ToolShowcase.jsx";
import { Badge } from "../components/ui.jsx";
import { CountUp, Reveal, pointerGlow, pointerReset } from "../components/motion.jsx";
import { outcome, useTestRuns, verdict } from "../components/testRuns.js";
import "../home.css";

const HEADLINE = "Your site, inspected in seconds.".split(" ");
const STEPS = [
  ["Add a photo or a few details", "Drop in site photos, or type a location, a brief or a question."],
  ["The AI reads it", "Gemini looks at the photos and the context, and answers in a fixed, checked format."],
  ["Get a report you can use", "Ranked findings and clear next steps. Print it, save it or download the JSON."],
];

function Status({ health }) {
  if (!health) return null;
  return health.mode === "demo"
    ? <span className="live-chip demo"><i /> Demo mode: sample reports</span>
    : <span className="live-chip"><i /> Live AI, {health.model}</span>;
}

export default function Dashboard({ health }) {
  const runs = useTestRuns();
  const [suite, setSuite] = useState(null);
  useEffect(() => {
    let live = true;
    fetch("/testing/suite.json").then((r) => r.json()).then((s) => live && setSuite(s)).catch(() => {});
    return () => { live = false; };
  }, []);
  const passed = runs?.filter((r) => verdict(r).pass).length ?? 0;

  return (
    <>
      <section className="hero2">
        <div className="aurora" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="wrap">
          <Status health={health} />
          <h1 aria-label="Your site, inspected in seconds.">
            {HEADLINE.map((w, i) => <span key={i} className="w" style={{ "--i": i }} aria-hidden="true">{w}</span>)}
          </h1>
          <p className="sub">Drop in a photo. BuildSight flags unsafe work, reads cracks, plans the build and prices the property, then tells you what to fix first.</p>
          <div className="hero-actions">
            <a className="btn primary big" href="#safety">Try it on your photo</a>
            <a className="chev" href="#testing">See the test results</a>
          </div>
          {health?.mode === "demo" && (
            <div className="alert warn" style={{ maxWidth: 560, margin: "24px auto 0" }}>
              The tools return sample reports right now. The test results below are real.
            </div>
          )}
        </div>
        <div className="scanner-wrap">
          {runs?.length ? <Scanner runs={runs} /> : <div className="scanner skeleton" aria-hidden="true" />}
        </div>
      </section>

      <section className="stats wrap">
        <Reveal><b><CountUp to={6} /></b><small>tools for one site day</small></Reveal>
        <Reveal delay={90}><b>{runs ? <><CountUp to={passed} />/{runs.length}</> : "–"}</b><small>real-photo tests passed</small></Reveal>
        <Reveal delay={180}><b>{suite ? <CountUp to={suite.passed} /> : "–"}</b><small>automated tests passing</small></Reveal>
      </section>

      <section className="block">
        <div className="wrap">
          <Reveal as="header" className="block-head">
            <h2>Six tools. One site day.</h2>
            <p>Pick one to see what it hands back.</p>
          </Reveal>
          <Reveal delay={80}><ToolShowcase runs={runs} /></Reveal>
        </div>
      </section>

      <section className="block alt">
        <div className="wrap">
          <Reveal as="header" className="block-head">
            <h2>From photo to plan in three steps.</h2>
          </Reveal>
          <ol className="steps">
            {STEPS.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 110}>
                <span className="n">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {runs?.length > 0 && (
        <section className="block">
          <div className="wrap">
            <Reveal as="header" className="block-head">
              <h2>Tested on real photos.</h2>
              <p>Five open-licensed photos went through the same analysis you use. Each one is checked against what the photo plainly shows.</p>
            </Reveal>
          </div>
          <div className="rail" tabIndex={0} role="group" aria-label="Test results, scroll sideways">
            {runs.map((r) => {
              const v = verdict(r);
              return (
                <a key={r.slug} href={`#testing/${r.slug}`} className="rail-card" onPointerMove={pointerGlow} onPointerLeave={pointerReset}>
                  <img src={r.file} alt={r.label} loading="lazy" />
                  <div>
                    <Badge value="test">Test run</Badge>
                    <b>{r.label}</b>
                    <span>{outcome(r)}</span>
                    <em className={v.pass ? "pass" : "fail"}>{v.pass ? "✓ Passed" : "✕ Missed"}: {r.expect}</em>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="cta-block wrap">
        <Reveal className="cta-card">
          <h2>Try it on your own site.</h2>
          <p>Free to use. Upload a photo and you get a report in about a minute.</p>
          <div className="hero-actions">
            <a className="btn light big" href="#safety">Check site safety</a>
            <a className="btn ghost big" href="#cracks">Check a crack</a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
