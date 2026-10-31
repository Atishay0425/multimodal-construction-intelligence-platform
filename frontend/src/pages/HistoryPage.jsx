import { useEffect, useState } from "react";
import { deleteHistory, getHistory } from "../api.js";
import { Badge, Card, ErrorBox, PageHeader } from "../components/ui.jsx";
import { AssistantResult, CrackResult, PlanningResult, SafetyResult, ValuationResult } from "../components/Results.jsx";
import { KnowledgeAnswerView } from "../components/Results.jsx";

const VIEWS = {
  safety: SafetyResult, cracks: CrackResult, valuation: ValuationResult, planning: PlanningResult,
  assistant: AssistantResult,
  knowledge: ({ data }) => <Card title={data.context.question}><KnowledgeAnswerView r={data.result} /></Card>,
};
export const KIND_LABEL = { safety: "Safety", cracks: "Cracks", valuation: "Valuation", planning: "Planning", assistant: "Daily briefing", knowledge: "Q&A" };

export default function HistoryPage({ param }) {
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const load = () => getHistory(kind).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [kind]);
  const open = rows.find((r) => r.id === param) || null;
  const setOpen = (r) => { location.hash = r ? `history/${r.id}` : "history"; };

  const remove = async (id) => {
    try { await deleteHistory(id); setOpen(null); load(); } catch (e) { setError(e.message); }
  };
  const View = open && VIEWS[open.kind];

  return (
    <>
      <PageHeader title="History" subtitle="Every analysis is saved locally so you can revisit or delete it." />
      <div className="filters">
        {["", ...Object.keys(KIND_LABEL)].map((k) => (
          <button key={k} className={`btn ${kind === k ? "primary" : ""}`} onClick={() => { setKind(k); setOpen(null); }}>{k ? KIND_LABEL[k] : "All"}</button>
        ))}
      </div>
      <ErrorBox message={error} />
      <div className="history-list">
        {rows.length === 0 && <p className="muted-text">No saved analyses yet.</p>}
        {rows.map((r) => (
          <button key={r.id} className={`history-item ${open?.id === r.id ? "active" : ""}`} onClick={() => setOpen(r)}>
            <Badge value="muted">{KIND_LABEL[r.kind]}</Badge>
            <span>{new Date(r.created_at).toLocaleString()}</span>
            {r.mode === "demo" && <Badge value="medium">demo</Badge>}
          </button>
        ))}
      </div>
      {open && (
        <>
          <div className="submit-row"><button className="btn danger" onClick={() => remove(open.id)}>Delete this analysis</button></div>
          <View data={open} />
        </>
      )}
    </>
  );
}
