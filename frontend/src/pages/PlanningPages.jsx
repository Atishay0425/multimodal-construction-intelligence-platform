import { useState } from "react";
import { postForm, useAnalysis } from "../api.js";
import { ErrorBox, Field, ImageDropzone, PageHeader, SubmitRow } from "../components/ui.jsx";
import { PlanningResult, ValuationResult } from "../components/Results.jsx";
import { AnalysisScene, Presets, ScrollIntoView } from "../components/toolMeta.jsx";

const VAL_EXAMPLES = [
  { label: "2BHK apartment", v: { property_type: "Apartment", location: "Vijay Nagar, Indore", area_sqft: "1050", bedrooms: "2", bathrooms: "2", age_years: "5", condition: "good", amenities: "parking, lift, security" } },
  { label: "Independent house", v: { property_type: "Independent house", location: "Aundh, Pune", area_sqft: "2400", bedrooms: "4", bathrooms: "3", age_years: "12", condition: "average", amenities: "garden, parking" } },
  { label: "Corner shop", v: { property_type: "Commercial shop", location: "MG Road, Bengaluru", area_sqft: "400", bedrooms: "", bathrooms: "1", age_years: "8", condition: "good", amenities: "street frontage" } },
];
const PLAN_EXAMPLES = [
  { label: "3BHK family home", v: { description: "Two-storey 3BHK family home with parking and a terrace garden", location: "Indore", built_up_area_sqm: "220", floors: "2", target_months: "10" } },
  { label: "Retail shop", v: { description: "Single-storey retail shop with a storage room and a small washroom", location: "Jaipur", built_up_area_sqm: "60", floors: "1", target_months: "4" } },
  { label: "Small warehouse", v: { description: "Steel-frame warehouse with a loading bay and a small site office", location: "Pune", built_up_area_sqm: "500", floors: "1", target_months: "6" } },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

export function ValuationPage() {
  const [files, setFiles] = useState([]);
  const [v, setV] = useState({ property_type: "Apartment", location: "", area_sqft: "", bedrooms: "", bathrooms: "",
    age_years: "", condition: "good", amenities: "", notes: "", currency: "INR" });
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const { loading, error, data, run } = useAnalysis((vals, f) => postForm("/api/valuation/estimate", vals, f));
  return (
    <>
      <PageHeader tool="valuation" title="Property valuation" subtitle="Enter the property details, with photos if you have them, to get an indicative price range." />
      <form className="form card" onSubmit={(e) => { e.preventDefault(); run(v, files); }}>
        <Presets items={VAL_EXAMPLES} onPick={(p) => setV({ ...v, ...p.v })} />
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
      {loading && <AnalysisScene tool="valuation" files={files} />}
      <ErrorBox message={error} />
      {data && <ScrollIntoView key={data.id}><ValuationResult data={data} /></ScrollIntoView>}
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
      <PageHeader tool="planning" title="Project planning" subtitle="Describe the building to get a cost estimate, material list, schedule and floor plan." />
      <form className="form card" onSubmit={(e) => { e.preventDefault(); run(v, files); }}>
        <Presets items={PLAN_EXAMPLES} onPick={(p) => setV({ ...v, ...p.v })} />
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
      {loading && <AnalysisScene tool="planning" files={files} />}
      <ErrorBox message={error} />
      {data && <ScrollIntoView key={data.id}><PlanningResult data={data} /></ScrollIntoView>}
    </>
  );
}
