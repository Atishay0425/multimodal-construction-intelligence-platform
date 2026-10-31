import { useEffect, useRef, useState } from "react";
import { deleteHistory, getHistory, getReport } from "../api.js";
import { Badge, Card, ErrorBox, ModeBanner, PageHeader } from "../components/ui.jsx";
import { ToolTile } from "../components/toolMeta.jsx";
import { cap } from "../components/testRuns.js";
import { money } from "../api.js";
import { AssistantResult, CrackResult, PlanningResult, SafetyResult, ValuationResult } from "../components/Results.jsx";
import { KnowledgeAnswerView } from "../components/Results.jsx";

const VIEWS = {
  safety: SafetyResult, cracks: CrackResult, valuation: ValuationResult, planning: PlanningResult,
  assistant: AssistantResult,
  knowledge: ({ data }) => (
    <div className="result">
      <ModeBanner envelope={data} />
      <Card title={data.context.question}><KnowledgeAnswerView r={data.result} /></Card>
    </div>
  ),
};
const DECISION = { go: "Good to go", proceed_with_caution: "Proceed with caution", hold: "Hold work" };

/** A one-line headline and a short summary for a saved report card. */
function headline(r) {
  const x = r.result ?? {};
  try {
    switch (r.kind) {
      case "safety": return [`${cap(x.overall_risk)} risk, ${x.risk_score} out of 100`, x.summary];
      case "cracks": return [x.cracks_detected ? `${cap(x.overall_severity)} crack` : "No cracks found", x.summary];
      case "valuation": return [money(x.estimated_value, x.currency), x.condition_assessment];
      case "planning": return [money(x.cost_summary.grand_total, x.cost_summary.currency), x.summary];
      case "assistant": return [DECISION[x.decision] ?? cap(x.decision), x.summary];
      case "knowledge": return [r.context?.question ?? "Question", x.answer];
    }
  } catch { /* fall through to the plain label */ }
  return [KIND_LABEL[r.kind] ?? r.kind, ""];
}

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!(s >= 0)) return new Date(iso).toLocaleString();
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const KIND_LABEL = { safety: "Site safety", cracks: "Crack analysis", valuation: "Valuation", planning: "Planning", assistant: "Daily briefing", knowledge: "Question" };

export default function HistoryPage({ param }) {
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [linked, setLinked] = useState(null); // a report opened by link that isn't in the current list
  useEffect(() => {
    let live = true; // ignore responses from a filter the user has already left
    getHistory(kind)
      .then((r) => { if (live) { setRows(r); setError(""); } })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [kind, version]);
  const listed = rows.find((r) => r.id === param);
  useEffect(() => {
    if (!param || listed) return;
    let live = true;
    getReport(param).then((r) => live && setLinked(r)).catch(() => live && setLinked({ id: param, missing: true }));
    return () => { live = false; };
  }, [param, listed]);
  const found = listed || (linked?.id === param ? linked : null);
  const open = found?.missing ? null : found;
  const report = useRef(null);
  // The list can be long, so bring the opened report into view.
  useEffect(() => {
    const el = report.current;
    if (open && el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ block: "start" });
  }, [open?.id]);
  const setOpen = (r) => { location.hash = r ? `history/${r.id}` : "history"; };

  const remove = async (id) => {
    if (!window.confirm("Delete this report? This can't be undone.")) return;
    try { await deleteHistory(id); setOpen(null); setVersion((v) => v + 1); } catch (e) { setError(e.message); }
  };
  const View = open && VIEWS[open.kind];

  return (
    <>
      <PageHeader tool="history" title="Saved reports" subtitle="Every report is saved here. Open one to view, print or delete it." />
      <div className="filters">
        {["", ...Object.keys(KIND_LABEL)].map((k) => (
          <button key={k} aria-pressed={kind === k} className={`btn ${kind === k ? "primary" : ""}`} onClick={() => { setKind(k); setOpen(null); }}>{k ? KIND_LABEL[k] : "All"}</button>
        ))}
      </div>
      <ErrorBox message={error} />
      {rows.length === 0 ? (
        <div className="empty">
          <ToolTile id="history" size={64} />
          <h2>No reports here yet</h2>
          <p>Run any tool and its report is saved automatically.</p>
          <div className="hero-actions"><a className="btn primary" href="#safety">Check site safety</a><a className="btn" href="#planning">Plan a build</a></div>
        </div>
      ) : (
        <div className="rep-grid">
          {rows.map((r, i) => {
            const [title, text] = headline(r);
            return (
              <button key={r.id} style={{ "--i": Math.min(i, 12) }} className={`rep-card ${open?.id === r.id ? "active" : ""}`} onClick={() => setOpen(r)} aria-pressed={open?.id === r.id}>
                <ToolTile id={r.kind === "knowledge" ? "knowledge" : r.kind} size={44} />
                <span className="rc-main">
                  <small>{KIND_LABEL[r.kind]}<span>{ago(r.created_at)}</span></small>
                  <b>{title}</b>
                  {r.mode === "demo" && <Badge value="medium">demo</Badge>}
                  {text && <span className="rc-text">{text}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {found?.missing && <div className="alert warn">That report wasn't found. It may have been deleted.</div>}
      {open && (
        <div ref={report} style={{ scrollMarginTop: 16 }}>
          <div className="submit-row"><button className="btn danger" onClick={() => remove(open.id)}>Delete report</button></div>
          <View data={open} />
        </div>
      )}
    </>
  );
}
