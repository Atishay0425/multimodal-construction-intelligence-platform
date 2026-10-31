import { useState } from "react";
import { login } from "../api.js";
import { BrandMark, ErrorBox } from "./ui.jsx";

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
        <div className="brand"><BrandMark /> BuildSight</div>
        <p className="muted-text">Enter the access password to use this site.</p>
        <input type="password" name="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)}
               placeholder="Access password" aria-label="Access password" />
        <ErrorBox message={error} />
        <button className="btn primary" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
      </form>
    </div>
  );
}
