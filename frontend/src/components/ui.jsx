import { useEffect, useRef, useState } from "react";
import { downloadJson } from "../api.js";

const TONE = {
  none: "ok", low: "ok", minor: "ok", go: "ok", high_conf: "ok", all: "ok",
  medium: "warn", moderate: "warn", proceed_with_caution: "warn", some: "warn", major: "warn",
  high: "bad", severe: "bad", hold: "bad", none_worn: "bad", stop_work: "bad", critical: "crit",
  not_assessable: "muted",
};

export function Badge({ value, children }) {
  const label = children ?? String(value).replaceAll("_", " ");
  return <span className={`badge ${TONE[value] ?? "muted"}`}>{label}</span>;
}

export function PageHeader({ title, subtitle }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

export function Card({ title, children, className = "", right }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="card-head">
          <h3>{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBox({ message }) {
  return message ? <div className="alert error" role="alert">{message}</div> : null;
}

export function Spinner({ label = "Analysing…" }) {
  return (
    <div className="spinner-row" role="status">
      <span className="spinner" /> {label}
    </div>
  );
}

export function List({ items, empty = "Nothing to report." }) {
  if (!items?.length) return <p className="muted-text">{empty}</p>;
  return (
    <ul className="plain-list">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export function ModeBanner({ envelope }) {
  if (!envelope) return null;
  return (
    <>
      <div className="report-actions no-print">
        <span className="meta-line">Report {envelope.id.slice(0, 8)} · {new Date(envelope.created_at).toLocaleString()}</span>
        <button type="button" className="btn small" onClick={() => window.print()}>Print / Save PDF</button>
        <button type="button" className="btn small" onClick={() => downloadJson(envelope)}>Download JSON</button>
      </div>
      <ModeNote envelope={envelope} />
    </>
  );
}

function ModeNote({ envelope }) {
  return envelope.mode === "demo" ? (
    <div className="alert info">
      <strong>Demo data.</strong> No API key is configured, so this is a sample response. Add
      <code>ANTHROPIC_API_KEY</code> to <code>backend/.env</code> for real analysis.
    </div>
  ) : (
    <div className="meta-line">Analysed by {envelope.model}</div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SubmitRow({ loading, label, disabled }) {
  return (
    <div className="submit-row">
      <button className="btn primary" type="submit" disabled={loading || disabled}>
        {loading ? "Working…" : label}
      </button>
      {loading && <Spinner />}
    </div>
  );
}

const MAX_MB = 10; // matches backend MAX_IMAGE_MB default

export function ImageDropzone({ files, setFiles, max = 5 }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach(URL.revokeObjectURL);
  }, [files]);

  const [warning, setWarning] = useState("");
  const add = (list) => {
    const all = Array.from(list);
    const imgs = all.filter((f) => f.type.startsWith("image/") && f.size <= MAX_MB * 1024 * 1024);
    const skipped = all.length - imgs.length;
    const room = max - files.length;
    setWarning(
      [skipped && `${skipped} file(s) skipped: not an image or over ${MAX_MB} MB.`,
       imgs.length > room && `Only ${max} images allowed; extra files ignored.`].filter(Boolean).join(" ")
    );
    setFiles([...files, ...imgs].slice(0, max));
  };

  return (
    <div>
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}
      >
        <strong>Drop photos here or click to browse</strong>
        <small>JPEG, PNG, WEBP or GIF · up to {max} images</small>
        <input ref={input} type="file" accept="image/*" multiple hidden
               onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
      {warning && <p className="hint warn-text">{warning}</p>}
      {files.length > 0 && (
        <div className="thumbs">
          {files.map((f, i) => (
            <figure key={f.name + i}>
              <img src={urls[i]} alt={f.name} />
              <button type="button" className="thumb-x" aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

export function Thumbs({ urls }) {
  if (!urls?.length) return null;
  return (
    <div className="thumbs">
      {urls.map((u) => (
        <figure key={u}><img src={u} alt="Uploaded" /></figure>
      ))}
    </div>
  );
}

export function Meter({ value, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone = v >= 75 ? "crit" : v >= 50 ? "bad" : v >= 25 ? "warn" : "ok";
  return (
    <div className="meter" aria-label={`${label}: ${v} of 100`}>
      <div className="meter-top"><span>{label}</span><strong>{v}/100</strong></div>
      <div className="meter-track"><div className={`meter-fill ${tone}`} style={{ width: `${v}%` }} /></div>
    </div>
  );
}
