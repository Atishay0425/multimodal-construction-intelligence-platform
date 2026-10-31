import { useEffect, useRef, useState } from "react";
import { postJson } from "../api.js";
import { ErrorBox, PageHeader, Spinner } from "../components/ui.jsx";
import { KnowledgeAnswerView } from "../components/Results.jsx";

const SUGGESTIONS = [
  "What curing period does M25 concrete need?",
  "When should I use a lap splice vs a mechanical coupler?",
  "What are the OSHA requirements for scaffold guardrails?",
];

export default function KnowledgePage() {
  const [turns, setTurns] = useState([]); // {role, content, answer?}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [turns, loading]);

  const send = async (text) => {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...turns, { role: "user", content: q }];
    setTurns(next); setInput(""); setError(""); setLoading(true);
    try {
      const res = await postJson("/api/knowledge/chat", {
        messages: next.map((t) => ({ role: t.role, content: t.content })),
      });
      setTurns([...next, { role: "assistant", content: res.result.answer, answer: res.result, demo: res.mode === "demo" }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Knowledge Assistant" subtitle="Ask about methods, materials, codes, safety and estimating." />
      <div className="chat card">
        {turns.length === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => <button key={s} className="btn" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            {t.answer ? <KnowledgeAnswerView r={t.answer} /> : t.content}
          </div>
        ))}
        {loading && <div className="bubble assistant"><Spinner label="Thinking…" /></div>}
        <div ref={end} />
      </div>
      <ErrorBox message={error} />
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} placeholder="Ask a construction question…" aria-label="Question" />
        <button className="btn primary" disabled={loading || !input.trim()}>Send</button>
      </form>
    </>
  );
}
