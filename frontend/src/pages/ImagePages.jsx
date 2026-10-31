import { useState } from "react";
import { postForm, useAnalysis } from "../api.js";
import { Card, ErrorBox, Field, ImageDropzone, PageHeader, SubmitRow } from "../components/ui.jsx";
import { AssistantResult, CrackResult, SafetyResult } from "../components/Results.jsx";

export function SafetyPage() {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [siteType, setSiteType] = useState("");
  const { loading, error, data, run } = useAnalysis((f, n, s) => postForm("/api/safety/analyze", { notes: n, site_type: s }, f));
  return (
    <>
      <PageHeader title="Site safety" subtitle="Upload site photos. The report lists hazards by severity, checks PPE and says what to fix first." />
      <form className="form card" onSubmit={(e) => { e.preventDefault(); run(files, notes, siteType); }}>
        <ImageDropzone files={files} setFiles={setFiles} />
        <div className="grid-2">
          <Field label="Site type (optional)">
            <select value={siteType} onChange={(e) => setSiteType(e.target.value)}>
              <option value="">Not specified</option>
              {["Residential building", "Commercial building", "Road / infrastructure", "Industrial", "Renovation"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 3rd floor slab shuttering in progress" /></Field>
        </div>
        <SubmitRow loading={loading} label="Analyse safety" disabled={!files.length} hint="Add at least one photo." />
      </form>
      <ErrorBox message={error} />
      {data && <SafetyResult data={data} />}
    </>
  );
}

export function CracksPage() {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [element, setElement] = useState("");
  const { loading, error, data, run } = useAnalysis((f, n, el) => postForm("/api/cracks/analyze", { notes: n, element: el }, f));
  return (
    <>
      <PageHeader title="Crack analysis" subtitle="Upload photos of a crack to get its type, likely cause, severity and repair steps." />
      <form className="form card" onSubmit={(e) => { e.preventDefault(); run(files, notes, element); }}>
        <ImageDropzone files={files} setFiles={setFiles} />
        <p className="hint">Include a coin, ruler or crack gauge in the frame so the width can be judged.</p>
        <div className="grid-2">
          <Field label="Element (optional)">
            <select value={element} onChange={(e) => setElement(e.target.value)}>
              <option value="">Not specified</option>
              {["Wall", "Column", "Beam", "Slab / ceiling", "Foundation / plinth", "Pavement / floor"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. appeared after monsoon, building is 8 years old" /></Field>
        </div>
        <SubmitRow loading={loading} label="Analyse cracks" disabled={!files.length} hint="Add at least one photo." />
      </form>
      <ErrorBox message={error} />
      {data && <CrackResult data={data} />}
    </>
  );
}

export function AssistantPage() {
  const [files, setFiles] = useState([]);
  const [v, setV] = useState({ location: "", activities: "", notes: "" });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const { loading, error, data, run } = useAnalysis((vals, f) => postForm("/api/assistant/daily", vals, f));
  return (
    <>
      <PageHeader title="Daily briefing" subtitle="Enter the site location and today's work. The briefing checks the forecast and says what can go ahead." />
      <form className="form card" onSubmit={(e) => { e.preventDefault(); run(v, files); }}>
        <div className="grid-2">
          <Field label="Site location" required hint="City or town, used for the forecast"><input required pattern=".*\S.*" title="Enter a city or town" name="location" autoComplete="address-level2" value={v.location} onChange={set("location")} placeholder="e.g. Indore" /></Field>
          <Field label="Planned activities" hint="Comma separated"><input value={v.activities} onChange={set("activities")} placeholder="slab concreting, bar bending, brickwork" /></Field>
        </div>
        <Field label="Notes (optional)"><input value={v.notes} onChange={set("notes")} placeholder="Anything the assistant should know" /></Field>
        <details><summary>Add site photos (optional)</summary><ImageDropzone files={files} setFiles={setFiles} /></details>
        <SubmitRow loading={loading} label="Get today's briefing" />
      </form>
      <ErrorBox message={error} />
      {data && <AssistantResult data={data} />}
    </>
  );
}
