import { useEffect, useRef, useState } from "react";
import { deleteHistory, getHistory, getReport } from "../api.js";
import { Badge, Card, ErrorBox, ModeBanner, PageHeader } from "../components/ui.jsx";
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
      <PageHeader title="Saved reports" subtitle="Every report is saved here. Open one to view, print or delete it." />
      <div className="filters">
        {["", ...Object.keys(KIND_LABEL)].map((k) => (
          <button key={k} aria-pressed={kind === k} className={`btn ${kind === k ? "primary" : ""}`} onClick={() => { setKind(k); setOpen(null); }}>{k ? KIND_LABEL[k] : "All"}</button>
        ))}
      </div>
      <ErrorBox message={error} />
      <div className="history-list">
        {rows.length === 0 && <p className="muted-text">No reports here yet. Run any tool and its report is saved automatically.</p>}
        {rows.map((r) => (
          <button key={r.id} className={`history-item ${open?.id === r.id ? "active" : ""}`} onClick={() => setOpen(r)}>
            <Badge value="muted">{KIND_LABEL[r.kind]}</Badge>
            <span>{new Date(r.created_at).toLocaleString()}</span>
            {r.mode === "demo" && <Badge value="medium">demo</Badge>}
          </button>
        ))}
      </div>
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
