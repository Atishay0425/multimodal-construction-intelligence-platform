import { money } from "../api.js";
import { Badge, Card, List, Meter, ModeBanner, Thumbs } from "./ui.jsx";

export function SafetyResult({ data }) {
  const r = data.result;
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <Thumbs urls={data.image_urls} />
      <Card title="Overall assessment" right={<Badge value={r.overall_risk}>{r.overall_risk} risk</Badge>}>
        <p>{r.summary}</p>
        <Meter value={r.risk_score} label="Risk score" />
        <p className="meta-line">Confidence: {r.confidence}. {r.image_quality_note}</p>
      </Card>
      <Card title="PPE check">
        <div className="stat-grid">
          <div><span>Workers visible</span><strong>{r.ppe.workers_visible}</strong></div>
          <div><span>Hard hats</span><Badge value={r.ppe.hard_hat} /></div>
          <div><span>High-vis vests</span><Badge value={r.ppe.high_vis_vest} /></div>
          <div><span>Gloves / footwear</span><Badge value={r.ppe.gloves_and_footwear} /></div>
        </div>
        {r.ppe.notes && <p className="muted-text">{r.ppe.notes}</p>}
      </Card>
      <Card title={`Findings (${r.findings.length})`}>
        {r.findings.length === 0 && <p className="muted-text">No hazards identified.</p>}
        {r.findings.map((f, i) => (
          <div className="finding" key={i}>
            <div className="finding-head">
              <Badge value={f.severity} /> <strong>{f.category === "ppe" ? "PPE" : f.category.replaceAll("_", " ")}</strong>
              <span className="muted-text">{f.location_in_image}</span>
            </div>
            <p>{f.description}</p>
            <p className="fix"><b>Fix:</b> {f.corrective_action}</p>
          </div>
        ))}
      </Card>
      <Card title="Immediate actions"><List items={r.immediate_actions} empty="No urgent actions." /></Card>
    </div>
  );
}

export function CrackResult({ data }) {
  const r = data.result;
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <Thumbs urls={data.image_urls} />
      <Card title="Overall assessment" right={<Badge value={r.overall_severity}>{r.overall_severity}</Badge>}>
        <p>{r.summary}</p>
        {r.requires_structural_engineer && (
          <div className="alert warn">Structural engineer inspection recommended.</div>
        )}
        <p className="meta-line">Confidence: {r.confidence}</p>
      </Card>
      {r.findings.map((f, i) => (
        <Card key={i} title={`${f.crack_type.charAt(0).toUpperCase()}${f.crack_type.slice(1).replaceAll("_", " ")} crack: ${f.location}`}
              right={<Badge value={f.severity} />}>
          <div className="stat-grid">
            <div><span>Orientation</span><strong>{f.orientation}</strong></div>
            <div><span>Est. width</span><strong>{f.estimated_width_mm > 0 ? `${f.estimated_width_mm} mm` : "n/a"}</strong></div>
          </div>
          <h4>Probable causes</h4><List items={f.probable_causes} />
          <h4>Recommended actions</h4><List items={f.recommended_actions} />
        </Card>
      ))}
      {!r.cracks_detected && <Card><p>No cracks detected in the supplied image(s).</p></Card>}
      <Card title="Monitoring plan"><p>{r.monitoring_plan}</p></Card>
      <Card title="Limitations"><p className="muted-text">{r.limitations}</p></Card>
    </div>
  );
}

export function ValuationResult({ data }) {
  const r = data.result;
  const span = r.high_estimate - r.low_estimate || 1;
  const pos = Math.max(0, Math.min(100, ((r.estimated_value - r.low_estimate) / span) * 100));
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <Thumbs urls={data.image_urls} />
      <Card title="Estimated value" right={<Badge value={r.confidence}>{r.confidence} confidence</Badge>}>
        <div className="big-number">{money(r.estimated_value, r.currency)}</div>
        <div className="range">
          <div className="range-bar"><i style={{ left: `${pos}%` }} /></div>
          <div className="range-labels"><span>{money(r.low_estimate, r.currency)}</span><span>{money(r.high_estimate, r.currency)}</span></div>
        </div>
        <p className="meta-line">≈ {money(r.price_per_sqft, r.currency)} per sq ft</p>
      </Card>
      <Card title="Condition"><p>{r.condition_assessment}</p></Card>
      <div className="two-col">
        <Card title="Value drivers"><List items={r.value_drivers} /></Card>
        <Card title="Risk factors"><List items={r.risk_factors} /></Card>
      </div>
      <Card title="Methodology"><p>{r.methodology}</p><p className="muted-text">{r.disclaimer}</p></Card>
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
        return (
          <div key={fl} className="floor">
            <h4>{FLOOR_NAMES[idx] ?? `Floor ${idx}`}, {total.toFixed(0)} m²</h4>
            {rows.map((row, i) => (
              <div className="plan-row" key={i}>
                {row.map((r, ri) => (
                  <div className="room" key={`${r.name}-${ri}`} style={{ width: r.width_m * scale, height: r.length_m * scale }}
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
  return (
    <div className="gantt">
      {tasks.map((t, ti) => (
        <div className="gantt-row" key={`${t.id}-${ti}`}>
          <div className="gantt-label" title={t.name}><small>{t.id}</small> {t.name}</div>
          <div className="gantt-track">
            <div className={`gantt-bar ${colour.get(t.phase)}`}
                 style={{ left: `${Math.min(98.5, (t.start_day / total) * 100)}%`,
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

export function PlanningResult({ data }) {
  const r = data.result;
  const c = r.cost_summary;
  const budget = data.context?.budget;
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <Thumbs urls={data.image_urls} />
      <Card title="Summary"><p>{r.summary}</p></Card>
      <Card title="Cost estimate" right={<strong>{money(c.grand_total, c.currency)}</strong>}>
        <div className="stat-grid">
          <div><span>Materials</span><strong>{money(c.materials_total, c.currency)}</strong></div>
          <div><span>Labour</span><strong>{money(c.labour_total, c.currency)}</strong></div>
          <div><span>Equipment</span><strong>{money(c.equipment_total, c.currency)}</strong></div>
          <div><span>Contingency</span><strong>{money(c.contingency, c.currency)}</strong></div>
        </div>
        {budget > 0 && (
          <p className={`alert ${c.grand_total > budget ? "warn" : "info"}`}>
            {c.grand_total > budget
              ? `Estimate exceeds your budget by ${money(c.grand_total - budget, c.currency)}.`
              : `Within your budget with ${money(budget - c.grand_total, c.currency)} headroom.`}
          </p>
        )}
      </Card>
      <Card title="Bill of materials">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Unit</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Total</th></tr></thead>
            <tbody>
              {r.materials.map((m, i) => (
                <tr key={i}><td>{m.item}</td><td>{m.unit}</td><td className="num">{m.quantity.toLocaleString()}</td>
                  <td className="num">{money(m.unit_cost, c.currency)}</td><td className="num">{money(m.total_cost, c.currency)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Schedule" right={<strong>{r.total_duration_days} days (~{(r.total_duration_days / 30).toFixed(1)} mo)</strong>}>
        <Gantt tasks={r.schedule} total={Math.max(1, r.total_duration_days)} />
      </Card>
      <Card title="Architectural concept">
        <p><b>{r.architecture.style}.</b> {r.architecture.description}</p>
        <FloorPlan rooms={r.architecture.rooms} />
        <h4>Key features</h4><List items={r.architecture.key_features} />
      </Card>
      <div className="two-col">
        <Card title="Assumptions"><List items={r.assumptions} /></Card>
        <Card title="Risks"><List items={r.risks} /></Card>
      </div>
    </div>
  );
}

export function AssistantResult({ data }) {
  const r = data.result;
  const w = data.context?.weather;
  return (
    <div className="result">
      <ModeBanner envelope={data} />
      <Card title="Today's briefing" right={<Badge value={r.decision}>{r.decision.replaceAll("_", " ")}</Badge>}>
        <p>{r.summary}</p>
      </Card>
      <Card title={w?.location ? `Forecast for ${w.location}` : "Forecast"}>
        {w?.days?.length ? (
          <div className="weather">
            {w.days.map((d) => (
              <div key={d.date} className="weather-day">
                <b>{new Date(d.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</b>
                <span>{d.summary}</span>
                <span>{Math.round(d.temp_min_c)}–{Math.round(d.temp_max_c)} °C</span>
                <span>Rain {d.precipitation_mm} mm</span>
                <span>Wind {Math.round(d.wind_max_kmh)} km/h</span>
              </div>
            ))}
          </div>
        ) : <p className="muted-text">The forecast is unavailable, so the advice below is general.</p>}
      </Card>
      <Card title="Activity impact">
        {r.activity_impacts.map((a, i) => (
          <div className="finding" key={i}>
            <div className="finding-head"><Badge value={a.impact} /> <strong>{a.activity}</strong></div>
            <p>{a.recommendation}</p>
          </div>
        ))}
      </Card>
      <div className="two-col">
        <Card title="Suggested schedule">
          {r.suggested_schedule.map((s, i) => <p key={i} className="slot"><b>{s.time}</b> {s.task}</p>)}
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
