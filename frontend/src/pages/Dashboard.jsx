import { Badge } from "../components/ui.jsx";
import { cap, outcome, useTestRuns } from "../components/testRuns.js";

const TILES = [
  { id: "safety", cls: "s4 dark", title: "Site safety", text: "Spot missing hard hats, open edges and loose debris before someone gets hurt.", go: "Check a site" },
  { id: "cracks", cls: "", title: "Crack analysis", text: "Settlement, shrinkage or overload? Get the likely cause and the repair.", go: "Check a crack" },
  { id: "planning", cls: "", title: "Project planning", text: "A cost estimate, material list, schedule and floor plan from a short brief.", go: "Plan a build" },
  { id: "valuation", cls: "", title: "Property valuation", text: "An indicative price range, with the reasoning behind it.", go: "Value a property" },
  { id: "assistant", cls: "", title: "Daily briefing", text: "Today's forecast, turned into a go or hold for each job.", go: "Get the briefing" },
];

export default function Dashboard({ health }) {
  const runs = useTestRuns();
  const hero = runs?.find((r) => r.slug === "fall-protection");
  const top = hero?.envelope.result.findings?.[0];
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Know your site.</h1>
          <p className="sub">Upload a photo or a few details. BuildSight checks for hazards and cracks, plans the build, reads the forecast and hands you a report.</p>
          <div className="hero-actions">
            <a className="btn primary" href="#safety">Check site safety</a>
            <a className="chev" href="#testing">See it tested on real photos</a>
          </div>
          {health?.mode === "demo" && (
            <div className="alert warn" style={{ maxWidth: 560, margin: "28px auto 0" }}>
              Demo mode: the tools return sample reports. The test results on this site are real.
            </div>
          )}
        </div>
        <div className="hero-visual">
          <img src="/testing/fall-protection.jpg" width="1024" height="766" alt="Two steelworkers on a high-rise steel frame" />
          {hero && top && (
            <div className="glass" role="group" aria-label="Result from a test photo">
              <div className="row"><Badge value="test">Test run</Badge><span className="meta-line">Site safety</span></div>
              <strong>{cap(hero.envelope.result.overall_risk)} risk, {hero.envelope.result.risk_score} out of 100</strong>
              <p>{top.description}</p>
            </div>
          )}
        </div>
      </section>

      <section className="home-section">
        <div className="wrap">
          <h2>Six tools for one site day.</h2>
          <p className="lead">Each one returns a structured report you can print, save or download as JSON.</p>
          <div className="bento">
            {TILES.map((t) => (
              <a key={t.id} href={`#${t.id}`} className={`tile ${t.cls}`}>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
                <span className="go chev">{t.go}</span>
              </a>
            ))}
            <a href="#knowledge" className="tile s6">
              <div>
                <h3>Ask a question</h3>
                <p>Curing times, lap lengths, scaffold rules. Answers name the standard they rely on.</p>
              </div>
              <div className="bubble-sample">How long should I cure an M25 slab in hot weather?</div>
              <span className="go chev">Ask now</span>
            </a>
          </div>
        </div>
      </section>

      {runs?.length > 0 && (
        <section className="dark-band">
          <div className="wrap">
            <h2>Tested on real photos.</h2>
            <p className="lead">Five open-licensed site photos went through the same analysis you use. Every result, and every photo credit, is on the Testing page.</p>
            <div className="proof">
              {runs.map((r) => (
                <a key={r.slug} href="#testing">
                  <img src={r.file} alt={r.label} loading="lazy" />
                  <span><b>{r.label}</b>{outcome(r)}</span>
                </a>
              ))}
            </div>
            <a className="more chev" href="#testing">See every test result</a>
          </div>
        </section>
      )}
    </>
  );
}
