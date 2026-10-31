import { useEffect, useMemo, useRef, useState } from "react";
import { downloadJson } from "../api.js";

const TONE = {
  none: "ok", low: "ok", minor: "ok", go: "ok", high_conf: "ok", all: "ok",
  medium: "warn", moderate: "warn", proceed_with_caution: "warn", some: "warn", major: "warn",
  high: "bad", severe: "bad", hold: "bad", none_worn: "bad", stop_work: "bad", critical: "crit",
  not_assessable: "muted", test: "test",
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
          <h2>{title}</h2>
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

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 20 20" aria-hidden="true">
      <rect width="20" height="20" rx="5" fill="#0071E3" />
      <path d="M4.5 14.5 10 4.5l5.5 10Z" fill="#fff" />
    </svg>
  );
}

/** Slim progress bar shown while the AI works. */
export function Spinner({ label = "Analysing…", compact = false }) {
  return (
    <div className={`progress ${compact ? "compact" : ""}`} role="status">
      <span className="tape" aria-hidden="true" /> {label}
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

const KIND_NAME = {
  safety: "Site safety", cracks: "Crack analysis", valuation: "Property valuation",
  planning: "Project planning", assistant: "Daily briefing", knowledge: "Question",
};

/** Report header laid out like the title block on a drawing sheet. */
export function ModeBanner({ envelope }) {
  if (!envelope) return null;
  const demo = envelope.mode === "demo";
  return (
    <>
      <div className="title-block">
        <div><span>Report</span><strong>{KIND_NAME[envelope.kind] ?? envelope.kind}{envelope.context?.testing && <>{" "}<Badge value="test">Test run</Badge></>}</strong></div>
        <div><span>Reference</span><strong>{envelope.id.slice(0, 8)}</strong></div>
        <div><span>Created</span><strong>{new Date(envelope.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</strong></div>
        <div><span>Analysed by</span><strong>{demo ? "Demo data" : envelope.model}</strong></div>
        <div className="tb-actions no-print">
          <button type="button" className="btn small" onClick={() => window.print()}>Print or save PDF</button>
          <button type="button" className="btn small" onClick={() => downloadJson(envelope)}>Download JSON</button>
        </div>
      </div>
      {demo && (
        <div className="alert info">
          This is a sample report because no AI key is set. Add <code>GEMINI_API_KEY</code> (free) or{" "}
          <code>ANTHROPIC_API_KEY</code> to the server settings for real analysis.
        </div>
      )}
    </>
  );
}

export function Field({ label, children, hint, required = false }) {
  return (
    <label className="field">
      <span>{label}{required && <span className="req" aria-hidden="true">*</span>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SubmitRow({ loading, label, disabled, hint }) {
  return (
    <div className="submit-row">
      <button className="btn primary" type="submit" disabled={loading || disabled}>
        {loading ? "Analysing…" : label}
      </button>
      {loading && <Spinner label="This can take up to a minute." />}
      {!loading && disabled && hint && <span className="hint">{hint}</span>}
    </div>
  );
}

const MAX_MB = 10; // matches backend MAX_IMAGE_MB default

export function ImageDropzone({ files, setFiles, max = 5 }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  // Created during render so thumbnails never point at an already-revoked URL.
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);

  const [warning, setWarning] = useState("");
  const add = (list) => {
    const all = Array.from(list);
    const imgs = all.filter((f) => f.type.startsWith("image/") && f.size <= MAX_MB * 1024 * 1024);
    const skipped = all.length - imgs.length;
    const room = max - files.length;
    setWarning(
      [skipped && `Skipped ${skipped} file(s): not an image, or larger than ${MAX_MB} MB.`,
       imgs.length > room && `Only ${max} photos fit; the rest were left out.`].filter(Boolean).join(" ")
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
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current.click(); } }}
      >
        <svg className="dz-icon" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="14" fill="#0071E3" fillOpacity=".12" /><path d="M24 31V17m0 0-6 6m6-6 6 6M16 33h16" fill="none" stroke="#0071E3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <strong>Drop photos here, or click to choose</strong>
        <small>JPEG, PNG, WEBP or GIF, up to {max} photos of {MAX_MB} MB each</small>
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
                      onClick={() => { setWarning(""); setFiles(files.filter((_, j) => j !== i)); }}>×</button>
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
        <figure key={u}><img src={u} alt="Uploaded site photo" loading="lazy" height={112} /></figure>
      ))}
    </div>
  );
}

export function Meter({ value, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  // Start empty, then fill, so the bar animates in.
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(v)); return () => cancelAnimationFrame(id); }, [v]);
  const tone = v >= 75 ? "crit" : v >= 50 ? "bad" : v >= 25 ? "warn" : "ok";
  return (
    <div className="meter" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="meter-top"><span>{label}</span><strong>{v}/100</strong></div>
      <div className="meter-track"><div className={`meter-fill ${tone}`} style={{ width: `${shown}%` }} /></div>
    </div>
  );
}
