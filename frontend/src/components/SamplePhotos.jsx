import { useEffect, useState } from "react";

/** One-click sample photos (the open-licensed test photos), so anyone can try a tool without their own image. */
export default function SamplePhotos({ tool, files, setFiles }) {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/testing/manifest.json").then((r) => r.json())
      .then((m) => live && setList(m.filter((x) => x.tool === tool)))
      .catch(() => {});
    return () => { live = false; };
  }, [tool]);
  if (!list.length) return null;

  const pick = async (s) => {
    setBusy(s.slug); setFailed(false);
    try {
      const blob = await (await fetch(s.file)).blob();
      setFiles([new File([blob], `${s.slug}.jpg`, { type: blob.type || "image/jpeg" })]);
    } catch { setFailed(true); }
    setBusy("");
  };
  return (
    <div className="samples">
      <span>No photo handy? Try a sample.</span>
      <div>
        {list.map((s) => {
          const on = files.some((f) => f.name === `${s.slug}.jpg`);
          return (
            <button type="button" key={s.slug} className={on ? "on" : ""} onClick={() => pick(s)} disabled={!!busy} aria-pressed={on} title={s.label}>
              <img src={s.file} alt="" loading="lazy" />
              <b>{busy === s.slug ? "Loading…" : s.label}</b>
            </button>
          );
        })}
      </div>
      {failed && <small className="warn-text">The sample couldn't be loaded. Try again or upload your own photo.</small>}
    </div>
  );
}
