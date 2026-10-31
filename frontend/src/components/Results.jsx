import { useEffect, useMemo, useState } from "react";
import { money } from "../api.js";
import { Badge, Card, List, ModeBanner, Thumbs } from "./ui.jsx";
import { Ring, SeverityTrack } from "./gauges.jsx";
import { cap } from "./testRuns.js";
import { useCountTo, useInView } from "./motion.jsx";

const RANK = { critical: 0, severe: 0, high: 1, medium: 2, moderate: 2, low: 3, minor: 3 };
const bySeverity = (a, b) => (RANK[a.severity] ?? 9) - (RANK[b.severity] ?? 9);

/** Photo on the left, headline result on the right. */
function ResultHero({ images, children }) {
  const first = images?.[0];
  return (
    <section className="res-hero">
      {first && (
        <div className="rh-photo">
          <img src={first} alt="Uploaded site photo" />
          {images.length > 1 && <span className="rh-more">+{images.length - 1} more</span>}
        </div>
      )}
      <div className="rh-body">{children}</div>
    </section>
  );
}

const PPE_TONE = { all: "ok", some: "warn", none: "bad" };
const PpeBadge = ({ value }) => <span className={`badge ${PPE_TONE[value] ?? "muted"}`}>{String(value).replaceAll("_", " ")}</span>;

function Findings({ items }) {
  const sorted = useMemo(() => [...items].sort(bySeverity), [items]);
  const [open, setOpen] = useState(0);
  return (
    <div className="fl">
      {sorted.map((f, i) => (
        <article key={i} className={`fcard ${f.severity} ${open === i ? "open" : ""}`}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span className={`dot ${f.severity}`}>{i + 1}</span>
            <span className="fc-main"><b>{cap(f.category)}</b><small>{f.location_in_image}</small></span>
            <Badge value={f.severity} />
            <span className="fc-chev" aria-hidden="true" />
          </button>
          <div className="fc-more"><div>
            <p>{f.description}</p>
            <p className="fix"><b>Fix</b>{f.corrective_action}</p>
          </div></div>
        </article>
      ))}
    </div>
  );
}

/** Actions the reader can tick off, with a progress bar. */
function Checklist({ items }) {
  const [done, setDone] = useState(() => new Set());
  if (!items?.length) return <p className="muted-text">No urgent actions.</p>;
  const toggle = (i) => setDone((d) => { const n = new Set(d); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <div className="checklist">
      <div className="cl-progress"><span>{done.size} of {items.length} done</span><i><b style={{ width: `${(done.size / items.length) * 100}%` }} /></i></div>
      {items.map((t, i) => (
        <label key={i} className={done.has(i) ? "done" : ""}>
          <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} />
          <span className="box" aria-hidden="true" /><span>{t}</span>
        </label>
      ))}
    </div>
  );
}

export function SafetyResult({ data }) {
  const r = data.result;
  const counts = {};
  r.findings.forEach((f) => { counts[f.severity] = (counts[f.severity] ?? 0) + 1; });
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <ResultHero images={data.image_urls}>
        <div className="rh-top">
          <Ring value={r.risk_score} tone={r.overall_risk} />
          <div>
            <span className="scan-kind">Site safety</span>
            <strong>{cap(r.overall_risk)} risk</strong>
            <div className="chips">{Object.entries(counts).sort(([a], [b]) => (RANK[a] ?? 9) - (RANK[b] ?? 9)).map(([s, n]) => <Badge key={s} value={s}>{n} {s}</Badge>)}</div>
          </div>
        </div>
        <p>{r.summary}</p>
        <p className="meta-line">Confidence: {r.confidence}. {r.image_quality_note}</p>
      </ResultHero>
      {data.image_urls?.length > 1 && <Thumbs urls={data.image_urls.slice(1)} />}
      <Card title="PPE check">
        <div className="stat-grid tiles">
          <div><span>Workers visible</span><strong>{r.ppe.workers_visible}</strong></div>
          <div><span>Hard hats</span><PpeBadge value={r.ppe.hard_hat} /></div>
          <div><span>High-vis vests</span><PpeBadge value={r.ppe.high_vis_vest} /></div>
          <div><span>Gloves and footwear</span><PpeBadge value={r.ppe.gloves_and_footwear} /></div>
        </div>
        {r.ppe.notes && <p className="muted-text">{r.ppe.notes}</p>}
      </Card>
      <Card title={`Findings (${r.findings.length})`}>
        {r.findings.length === 0 ? <p className="muted-text">No hazards identified.</p> : <Findings items={r.findings} />}
      </Card>
      <Card title="Do these first"><Checklist items={r.immediate_actions} /></Card>
    </div>
  );
}

export function CrackResult({ data }) {
  const r = data.result;
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <ResultHero images={data.image_urls}>
        <span className="scan-kind">Crack analysis</span>
        <strong className="rh-title">{r.cracks_detected ? `${cap(r.overall_severity)} crack` : "No cracks found"}</strong>
        {r.cracks_detected && <SeverityTrack value={r.overall_severity} />}
        <p>{r.summary}</p>
        {r.requires_structural_engineer && <div className="alert warn"><b>Get a structural engineer to look at this.</b> Don't rely on a visual check alone.</div>}
        <p className="meta-line">Confidence: {r.confidence}</p>
      </ResultHero>
      {data.image_urls?.length > 1 && <Thumbs urls={data.image_urls.slice(1)} />}
      {r.findings.map((f, i) => (
        <Card key={i} title={`${cap(f.crack_type)} crack`} right={<Badge value={f.severity} />}>
          <p className="muted-text" style={{ marginTop: -6 }}>{f.location}</p>
          <div className="stat-grid tiles">
            <div><span>Orientation</span><strong>{cap(f.orientation)}</strong></div>
            <div><span>Estimated width</span><strong>{f.estimated_width_mm > 0 ? `${f.estimated_width_mm} mm` : "n/a"}</strong></div>
          </div>
          <div className="two-col flat">
            <div><h4>Probable causes</h4><List items={f.probable_causes} /></div>
            <div><h4>Recommended actions</h4><Checklist items={f.recommended_actions} /></div>
          </div>
        </Card>
      ))}
      {!r.cracks_detected && <Card><p>No cracks detected in the supplied image(s).</p></Card>}
      <div className="two-col">
        <Card title="Monitoring plan"><p>{r.monitoring_plan}</p></Card>
        <Card title="Limitations"><p className="muted-text">{r.limitations}</p></Card>
      </div>
    </div>
  );
}

function CountMoney({ value, currency }) {
  const [ref, seen] = useInView(0.3);
  const n = useCountTo(value, seen, 1400);
  return <span ref={ref}>{money(n, currency)}</span>;
}

export function ValuationResult({ data }) {
  const r = data.result;
  const span = r.high_estimate - r.low_estimate || 1;
  const pos = Math.max(0, Math.min(100, ((r.estimated_value - r.low_estimate) / span) * 100));
  const [knob, setKnob] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setKnob(pos)); return () => cancelAnimationFrame(id); }, [pos]);
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <Thumbs urls={data.image_urls} />
      <section className="val-hero">
        <span className="scan-kind">Estimated value</span>
        <div className="big-number"><CountMoney value={r.estimated_value} currency={r.currency} /></div>
        <div className="val-range">
          <div className="val-track"><i className="band" /><i className="knob" style={{ left: `${knob}%` }} /></div>
          <div className="range-labels"><span><small>Low</small>{money(r.low_estimate, r.currency)}</span><span><small>High</small>{money(r.high_estimate, r.currency)}</span></div>
        </div>
        <div className="chips"><Badge value={r.confidence}>{r.confidence} confidence</Badge><span className="chip">about {money(r.price_per_sqft, r.currency)} per sq ft</span></div>
      </section>
      <Card title="Condition"><p>{r.condition_assessment}</p></Card>
      <div className="two-col">
        <Card title="What adds value"><List items={r.value_drivers} className="up" /></Card>
        <Card title="What to watch"><List items={r.risk_factors} className="down" /></Card>
      </div>
      <Card title="How this was worked out"><p>{r.methodology}</p><p className="muted-text">{r.disclaimer}</p></Card>
    </div>
  );
}

const FLOOR_NAMES = ["Ground floor", "First floor", "Second floor", "Third floor"];

function FloorPlan({ rooms }) {
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const scale = 28; // px per metre
  return (
    <div className="floors">
      {floors.map((fl, idx) => {
        const rs = rooms.filter((r) => r.floor === fl);
        const total = rs.reduce((a, r) => a + r.width_m * r.length_m, 0);
        const rowW = Math.max(14, Math.sqrt(total) * 1.6); // wrap rooms into rows of ~this width (m)
        const rows = [[]];
        let w = 0;
        rs.forEach((r) => {
          if (w + r.width_m > rowW && rows.at(-1).length) { rows.push([]); w = 0; }
          rows.at(-1).push(r); w += r.width_m;
        });
        let n = 0;
        return (
          <div key={fl} className="floor">
            <h4>{FLOOR_NAMES[idx] ?? `Floor ${idx}`}, {total.toFixed(0)} m²</h4>
            {rows.map((row, i) => (
              <div className="plan-row" key={i}>
                {row.map((r, ri) => (
                  <div className={`room r${n++ % 6}`} key={`${r.name}-${ri}`} style={{ width: r.width_m * scale, height: r.length_m * scale }}
                       title={`${r.name}: ${r.width_m} × ${r.length_m} m`}>
                    <b>{r.name}</b><small>{r.width_m}×{r.length_m} m</small>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Gantt({ tasks, total }) {
  const phases = [...new Set(tasks.map((t) => t.phase))];
  const colour = new Map(phases.map((p, i) => [p, `p${i % 8}`]));
  const [ref, seen] = useInView(0.15);
  return (
    <div className={`gantt ${seen ? "in" : ""}`} ref={ref}>
      {tasks.map((t, ti) => (
        <div className="gantt-row" key={`${t.id}-${ti}`}>
          <div className="gantt-label" title={t.name}><small>{t.id}</small> {t.name}</div>
          <div className="gantt-track">
            <div className={`gantt-bar ${colour.get(t.phase)}`}
                 style={{ "--i": Math.min(ti, 24), left: `${Math.min(98.5, (t.start_day / total) * 100)}%`,
                          width: `${Math.max(1.5, Math.min(100 - (t.start_day / total) * 100, (t.duration_days / total) * 100))}%` }}
                 title={`${t.phase}: day ${t.start_day} → ${t.start_day + t.duration_days}`}>
              {t.duration_days}d
            </div>
          </div>
        </div>
      ))}
      <div className="legend">{phases.map((p, i) => <span key={p}><i className={`p${i % 8}`} /> {p}</span>)}</div>
    </div>
  );
}

const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function PlanningResult({ data }) {
  const r = data.result;
  const c = r.cost_summary;
  const budget = data.context?.budget;
  const parts = [["Materials", c.materials_total], ["Labour", c.labour_total], ["Equipment", c.equipment_total], ["Contingency", c.contingency]];
  const sum = parts.reduce((a, [, v]) => a + v, 0) || 1;
  const [costRef, costSeen] = useInView(0.3);
  const top = Math.max(1, ...r.materials.map((m) => m.total_cost));
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <Thumbs urls={data.image_urls} />
      <section className="plan-hero">
        <div>
          <span className="scan-kind">Estimated total</span>
          <div className="big-number"><CountMoney value={c.grand_total} currency={c.currency} /></div>
        </div>
        <div className="plan-kpis">
          <div><small>Duration</small><b>{r.total_duration_days} days</b><span>about {(r.total_duration_days / 30).toFixed(1)} months</span></div>
          <div><small>Materials</small><b>{r.materials.length}</b><span>line items</span></div>
          <div><small>Rooms</small><b>{r.architecture.rooms.length}</b><span>{r.architecture.style}</span></div>
        </div>
        <p>{r.summary}</p>
      </section>
      <nav className="res-nav no-print" aria-label="Jump to a section">
        {[["cost", "Cost"], ["materials", "Materials"], ["schedule", "Schedule"], ["concept", "Floor plan"], ["risks", "Risks"]].map(([id, t]) => <button type="button" key={id} onClick={() => jump(id)}>{t}</button>)}
      </nav>
      <Card title="Cost estimate" id="cost">
        <div ref={costRef}><div className={`split ${costSeen ? "in" : ""}`} role="img" aria-label="Cost split">{parts.map(([n, v], i) => <i key={n} className={`s${i}`} style={{ flexBasis: `${(v / sum) * 100}%` }} />)}</div></div>
        <ul className="split-legend">
          {parts.map(([n, v], i) => <li key={n}><i className={`s${i}`} /><span>{n}</span><b>{money(v, c.currency)}</b><small>{Math.round((v / sum) * 100)}%</small></li>)}
        </ul>
        {budget > 0 && (
          <p className={`alert ${c.grand_total > budget ? "warn" : "info"}`}>
            {c.grand_total > budget
              ? `Estimate exceeds your budget by ${money(c.grand_total - budget, c.currency)}.`
              : `Within your budget with ${money(budget - c.grand_total, c.currency)} headroom.`}
          </p>
        )}
      </Card>
      <Card title="Bill of materials" id="materials">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Unit</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Total</th></tr></thead>
            <tbody>
              {r.materials.map((m, i) => (
                <tr key={i}><td>{m.item}</td><td>{m.unit}</td><td className="num">{m.quantity.toLocaleString()}</td>
                  <td className="num">{money(m.unit_cost, c.currency)}</td>
                  <td className="num tot">{money(m.total_cost, c.currency)}<i style={{ width: `${(m.total_cost / top) * 100}%` }} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Schedule" id="schedule" right={<strong>{r.total_duration_days} days (~{(r.total_duration_days / 30).toFixed(1)} mo)</strong>}>
        <Gantt tasks={r.schedule} total={Math.max(1, r.total_duration_days)} />
      </Card>
      <Card title="Architectural concept" id="concept">
        <p><b>{r.architecture.style}.</b> {r.architecture.description}</p>
        <FloorPlan rooms={r.architecture.rooms} />
        <h4>Key features</h4><List items={r.architecture.key_features} />
      </Card>
      <div className="two-col" id="risks">
        <Card title="Assumptions"><List items={r.assumptions} /></Card>
        <Card title="Risks"><List items={r.risks} className="down" /></Card>
      </div>
    </div>
  );
}

const DECISION = { go: "Good to go", proceed_with_caution: "Proceed with caution", hold: "Hold work" };

function WeatherIcon({ d }) {
  const kind = d.precipitation_mm >= 1 ? "rain" : d.wind_max_kmh >= 35 ? "wind" : /cloud|overcast|fog/i.test(d.summary) ? "cloud" : "sun";
  const p = {
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
    cloud: <path d="M7 18.5h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.4 1.4A3.4 3.4 0 0 0 7 18.5Z" />,
    rain: <><path d="M7 14.5h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.4 1.4A3.4 3.4 0 0 0 7 14.5Z" /><path d="m8 18 -1 2.5M12 18l-1 2.5M16 18l-1 2.5" /></>,
    wind: <><path d="M3 9h10a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 19h6" /></>,
  }[kind];
  return <svg className={`wx ${kind}`} viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>;
}

export function AssistantResult({ data }) {
  const r = data.result;
  const w = data.context?.weather;
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <section className={`decision ${r.decision}`}>
        <span className="scan-kind">Today on site</span>
        <strong>{DECISION[r.decision] ?? cap(r.decision)}</strong>
        <p>{r.summary}</p>
      </section>
      <Card title={w?.location ? `Forecast for ${w.location}` : "Forecast"}>
        {w?.days?.length ? (
          <div className="weather">
            {w.days.map((d, i) => (
              <div key={d.date} className={`weather-day ${i === 0 ? "today" : ""}`}>
                <WeatherIcon d={d} />
                <b>{i === 0 ? "Today" : new Date(d.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</b>
                <strong>{Math.round(d.temp_max_c)}°<small> / {Math.round(d.temp_min_c)}°</small></strong>
                <span>{d.summary}</span>
                <span>Rain {d.precipitation_mm} mm</span>
                <span>Wind {Math.round(d.wind_max_kmh)} km/h</span>
              </div>
            ))}
          </div>
        ) : <p className="muted-text">The forecast is unavailable, so the advice below is general.</p>}
      </Card>
      <Card title="Activity impact">
        <div className="impacts">
          {r.activity_impacts.map((a, i) => (
            <div className={`impact ${a.impact}`} key={i}>
              <div className="finding-head"><strong>{a.activity}</strong><Badge value={a.impact} /></div>
              <p>{a.recommendation}</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="two-col">
        <Card title="Suggested schedule">
          <ol className="timeline">{r.suggested_schedule.map((s, i) => <li key={i}><b>{s.time}</b><span>{s.task}</span></li>)}</ol>
        </Card>
        <Card title="Safety reminders"><List items={r.safety_reminders} /></Card>
      </div>
      <Card title="Material handling"><List items={r.material_handling_notes} /></Card>
    </div>
  );
}

export function KnowledgeAnswerView({ r }) {
  return (
    <div className="answer">
      <p>{r.answer}</p>
      {r.key_points.length > 0 && <><h4>Key points</h4><List items={r.key_points} /></>}
      {r.standards_referenced.length > 0 && (
        <p className="chips">{r.standards_referenced.map((s, i) => <span key={`${s}-${i}`} className="chip">{s}</span>)}</p>
      )}
      <p className="muted-text">{r.disclaimer}</p>
    </div>
  );
}
