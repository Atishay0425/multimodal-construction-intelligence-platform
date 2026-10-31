import { useState } from "react";
import { login } from "../api.js";
import { ErrorBox } from "./ui.jsx";

export default function Login({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await login(password); onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <div className="brand dark"><span className="brand-mark">▲</span> BuildSight</div>
        <p className="muted-text">This deployment is password protected.</p>
        <input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)}
               placeholder="Access password" aria-label="Access password" />
        <ErrorBox message={error} />
        <button className="btn primary" disabled={busy}>{busy ? "Checking…" : "Enter"}</button>
      </form>
    </div>
  );
}
