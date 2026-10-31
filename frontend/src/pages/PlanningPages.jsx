import { useState } from "react";
import { postForm, useAnalysis } from "../api.js";
import { ErrorBox, Field, ImageDropzone, PageHeader, SubmitRow } from "../components/ui.jsx";
import { PlanningResult, ValuationResult } from "../components/Results.jsx";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

export function ValuationPage() {
  const [files, setFiles] = useState([]);
  const [v, setV] = useState({ property_type: "Apartment", location: "", area_sqft: "", bedrooms: "", bathrooms: "",
    age_years: "", condition: "good", amenities: "", notes: "", currency: "INR" });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const { loading, error, data, run } = useAnalysis((vals, f) => postForm("/api/valuation/estimate", vals, f));
  return (
    <>
      <PageHeader title="Property valuation" subtitle="Enter the property details, with photos if you have them, to get an indicative price range." />
      <form className="form card" onSubmit={(e) => { e.preventDefault(); run(v, files); }}>
        <div className="grid-3">
          <Field label="Property type"><select value={v.property_type} onChange={set("property_type")}>
            {["Apartment", "Independent house", "Villa", "Plot with structure", "Commercial shop", "Office space"].map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Location" required><input required pattern=".*\S.*" title="Enter a locality and city" maxLength={300} value={v.location} onChange={set("location")} placeholder="Locality, city" /></Field>
          <Field label="Area (sq ft)" required><input required type="number" min="1" max="10000000" step="any" value={v.area_sqft} onChange={set("area_sqft")} /></Field>
          <Field label="Bedrooms"><input type="number" min="0" max="100" value={v.bedrooms} onChange={set("bedrooms")} /></Field>
          <Field label="Bathrooms"><input type="number" min="0" max="100" value={v.bathrooms} onChange={set("bathrooms")} /></Field>
          <Field label="Age (years)"><input type="number" min="0" max="500" step="any" value={v.age_years} onChange={set("age_years")} /></Field>
          <Field label="Condition"><select value={v.condition} onChange={set("condition")}>
            {["excellent", "good", "average", "poor"].map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Currency"><select value={v.currency} onChange={set("currency")}>{CURRENCIES.map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Amenities"><input value={v.amenities} onChange={set("amenities")} placeholder="parking, lift, gym…" /></Field>
        </div>
        <Field label="Notes (optional)"><input value={v.notes} onChange={set("notes")} /></Field>
        <details><summary>Add property photos (optional)</summary><ImageDropzone files={files} setFiles={setFiles} /></details>
        <SubmitRow loading={loading} label="Estimate value" />
      </form>
      <ErrorBox message={error} />
      {data && <ValuationResult data={data} />}
    </>
  );
}

export function PlanningPage() {
  const [files, setFiles] = useState([]);
  const [v, setV] = useState({ description: "", location: "", built_up_area_sqm: "", floors: "1", budget: "", currency: "INR", target_months: "" });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const { loading, error, data, run } = useAnalysis((vals, f) => postForm("/api/planning/generate", vals, f));
  return (
    <>
      <PageHeader title="Project planning" subtitle="Describe the building to get a cost estimate, material list, schedule and floor plan." />
      <form className="form card" onSubmit={(e) => { e.preventDefault(); run(v, files); }}>
        <Field label="Project description" required>
          <textarea required minLength={10} maxLength={4000} rows={3} value={v.description} onChange={set("description")}
                    placeholder="e.g. Two-storey 3BHK family home with parking and a terrace garden" />
        </Field>
        <div className="grid-3">
          <Field label="Location"><input value={v.location} onChange={set("location")} placeholder="City / region" /></Field>
          <Field label="Built-up area (m²)" required><input required type="number" min="1" max="1000000" step="any" value={v.built_up_area_sqm} onChange={set("built_up_area_sqm")} /></Field>
          <Field label="Floors" required><input required type="number" min="1" max="60" value={v.floors} onChange={set("floors")} /></Field>
          <Field label="Budget (optional)"><input type="number" min="1" max="10000000000000" step="any" value={v.budget} onChange={set("budget")} /></Field>
          <Field label="Currency"><select value={v.currency} onChange={set("currency")}>{CURRENCIES.map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Target duration (months)"><input type="number" min="1" max="240" value={v.target_months} onChange={set("target_months")} /></Field>
        </div>
        <details><summary>Add site / reference photos (optional)</summary><ImageDropzone files={files} setFiles={setFiles} /></details>
        <SubmitRow loading={loading} label="Generate plan" />
      </form>
      <ErrorBox message={error} />
      {data && <PlanningResult data={data} />}
    </>
  );
}
