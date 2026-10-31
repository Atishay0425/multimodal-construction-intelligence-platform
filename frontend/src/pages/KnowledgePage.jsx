import { useEffect, useRef, useState } from "react";
import { postJson } from "../api.js";
import { ErrorBox, PageHeader } from "../components/ui.jsx";
import { KnowledgeAnswerView } from "../components/Results.jsx";
import { ToolTile } from "../components/toolMeta.jsx";

const TOPICS = [
  ["Concrete", "What curing period does M25 concrete need?"],
  ["Rebar", "When should I use a lap splice vs a mechanical coupler?"],
  ["Scaffolding", "What are the OSHA requirements for scaffold guardrails?"],
  ["Estimating", "How many bricks do I need for a 10 m by 3 m wall, 230 mm thick?"],
  ["Formwork", "When can I safely strike slab formwork?"],
  ["Site safety", "What should a daily toolbox talk cover?"],
];

export default function KnowledgePage() {
  const [turns, setTurns] = useState([]); // {role, content, answer?}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const body = useRef(null);
  // Keep the newest message in view inside the chat window.
  // Braces matter: returning a value from an effect would make React treat it as a cleanup.
  useEffect(() => { const el = body.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }, [turns, loading]);

  const send = async (text) => {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...turns, { role: "user", content: q }];
    setTurns(next); setInput(""); setError(""); setLoading(true);
    try {
      const res = await postJson("/api/knowledge/chat", {
        // The server keeps only recent context and caps each message at 4000 characters.
        messages: next.slice(-9).map((t) => ({ role: t.role, content: t.content.slice(0, 4000) })),
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
      <PageHeader tool="knowledge" title="Ask a question" subtitle="Ask about methods, materials, codes, safety or estimating. Answers cite the standards they rely on." />
      <section className="chat-shell">
        <div className="chat-top">
          <ToolTile id="knowledge" size={38} />
          <div><b>Construction assistant</b><small>Answers name the standard they rely on</small></div>
          {turns.length > 0 && <button type="button" className="btn small" onClick={() => { setTurns([]); setError(""); }} disabled={loading}>New chat</button>}
        </div>
        <div className="chat-body" ref={body} aria-live="polite">
          {turns.length === 0 && (
            <div className="chat-empty">
              <h2>What do you need to know?</h2>
              <p>Pick a topic or type your own question.</p>
              <div className="topics">
                {TOPICS.map(([tag, q]) => (
                  <button type="button" key={tag} onClick={() => send(q)}><small>{tag}</small><span>{q}</span></button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`msg ${t.role}`}>
              {t.role === "assistant" && <ToolTile id="knowledge" size={30} />}
              <div className={`bubble ${t.role}`}>{t.answer ? <KnowledgeAnswerView r={t.answer} /> : t.content}</div>
            </div>
          ))}
          {loading && (
            <div className="msg assistant"><ToolTile id="knowledge" size={30} /><div className="bubble assistant typing-dots" role="status" aria-label="Thinking"><i /><i /><i /></div></div>
          )}
        </div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} name="question" autoComplete="off" placeholder="e.g. How long should I cure an M25 slab in summer?" aria-label="Question" />
          <button className="send" disabled={loading || !input.trim()} aria-label="Send">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>
          </button>
        </form>
      </section>
      <ErrorBox message={error} />
    </>
  );
}
