import { Component, useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import { AssistantPage, CracksPage, SafetyPage } from "./pages/ImagePages.jsx";
import { PlanningPage, ValuationPage } from "./pages/PlanningPages.jsx";
import KnowledgePage from "./pages/KnowledgePage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import Login from "./components/Login.jsx";
import { BrandMark } from "./components/ui.jsx";
import { getHealth } from "./api.js";

const PAGES = {
  safety: SafetyPage, cracks: CracksPage, valuation: ValuationPage, planning: PlanningPage,
  assistant: AssistantPage, knowledge: KnowledgePage, history: HistoryPage,
};

export const NAV = [
  { group: "Inspect", items: [{ id: "safety", title: "Site safety" }, { id: "cracks", title: "Crack analysis" }] },
  { group: "Plan", items: [{ id: "planning", title: "Project planning" }, { id: "valuation", title: "Property valuation" }] },
  { group: "On site", items: [{ id: "assistant", title: "Daily briefing" }, { id: "knowledge", title: "Ask a question" }] },
  { group: "Records", items: [{ id: "history", title: "Saved reports" }] },
];

class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="alert error" role="alert">
        This page hit an unexpected error. <a href="#dashboard" onClick={() => this.setState({ failed: false })}>Go to the overview</a> or reload the page.
      </div>
    );
  }
}

function AiStatus({ health, down }) {
  if (down) return <div className="ai-status down"><i /> Can't reach the server.</div>;
  if (!health) return <div className="ai-status"><i /> Checking the server…</div>;
  if (health.mode === "demo") return <div className="ai-status demo"><i /> Demo mode: sample answers only.</div>;
  return <div className="ai-status live"><i /> Live AI on {health.model}</div>;
}

export default function App() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "dashboard");
  const [page, param] = route.split("/");
  useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [health, setHealth] = useState(null);
  const [down, setDown] = useState(false);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    getHealth()
      .then((h) => { setHealth(h); setLocked(h.auth_required && !h.authenticated); })
      .catch(() => setDown(true));
    const lock = () => setLocked(true);
    window.addEventListener("auth-required", lock);
    return () => window.removeEventListener("auth-required", lock);
  }, []);
  const go = (p) => { location.hash = p; window.scrollTo(0, 0); document.getElementById("main")?.focus({ preventScroll: true }); };
  const Page = Object.hasOwn(PAGES, page) ? PAGES[page] : null;
  if (locked) return <Login onDone={() => setLocked(false)} />;
  return (
    <div className="shell">
      <button type="button" className="skip" onClick={() => document.getElementById("main")?.focus()}>Skip to content</button>
      <nav className="sidebar" aria-label="Main">
        <a className="brand" href="#dashboard" aria-label="BuildSight overview" translate="no"><BrandMark /> BuildSight</a>
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <span>{g.group}</span>
            {g.items.map((n) => (
              <button type="button" key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`}
                      aria-current={page === n.id ? "page" : undefined} onClick={() => go(n.id)}>
                {n.title}
              </button>
            ))}
          </div>
        ))}
        <AiStatus health={health} down={down} />
      </nav>
      <main className="content" id="main" tabIndex={-1}>
        {/* Keyed so each module starts fresh and never shows another module's results. */}
        <PageBoundary key={page}>
          {Page ? <Page key={page} param={param} /> : <Dashboard go={go} health={health} />}
        </PageBoundary>
      </main>
    </div>
  );
}
