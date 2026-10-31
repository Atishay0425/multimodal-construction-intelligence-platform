import { Component, useEffect, useRef, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import { AssistantPage, CracksPage, SafetyPage } from "./pages/ImagePages.jsx";
import { PlanningPage, ValuationPage } from "./pages/PlanningPages.jsx";
import KnowledgePage from "./pages/KnowledgePage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import TestingPage from "./pages/TestingPage.jsx";
import Login from "./components/Login.jsx";
import { BrandMark } from "./components/ui.jsx";
import { ScrollProgress } from "./components/motion.jsx";
import { getHealth } from "./api.js";

const PAGES = {
  safety: SafetyPage, cracks: CracksPage, valuation: ValuationPage, planning: PlanningPage,
  assistant: AssistantPage, knowledge: KnowledgePage, history: HistoryPage, testing: TestingPage,
};

const NAV = [
  { id: "safety", title: "Safety" }, { id: "cracks", title: "Cracks" }, { id: "planning", title: "Planning" },
  { id: "valuation", title: "Valuation" }, { id: "assistant", title: "Briefing" }, { id: "knowledge", title: "Ask" },
  { id: "history", title: "Reports" }, { id: "testing", title: "Testing" },
];

class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="alert error" role="alert">
        This page hit an unexpected error. <a href="#dashboard" onClick={() => this.setState({ failed: false })}>Go to the home page</a> or reload.
      </div>
    );
  }
}

function Status({ health, down }) {
  if (down) return <span className="nav-status down"><i /> Server unreachable</span>;
  if (!health) return <span className="nav-status"><i /> Connecting</span>;
  if (health.mode === "demo") return <span className="nav-status demo"><i /> Demo mode</span>;
  return <span className="nav-status live" title={health.model}><i /> Live AI</span>;
}

export default function App() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "dashboard");
  const [page, param] = route.split("/");
  const lastPage = useRef(page);
  useEffect(() => {
    const onHash = () => {
      const next = location.hash.slice(1) || "dashboard";
      setRoute(next);
      // Only jump to the top when the page changes, so deep links can scroll to their report.
      if (next.split("/")[0] !== lastPage.current) window.scrollTo(0, 0);
      lastPage.current = next.split("/")[0];
    };
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
  const Page = Object.hasOwn(PAGES, page) ? PAGES[page] : null;
  if (locked) return <Login onDone={() => setLocked(false)} />;
  return (
    <div className={`app ${Page ? "inner" : "home"}`}>
      <button type="button" className="skip" onClick={() => document.getElementById("main")?.focus()}>Skip to content</button>
      <header className="nav">
        <nav className="nav-in" aria-label="Main">
          <a className="brand" href="#dashboard" aria-label="BuildSight home" translate="no"><BrandMark /> BuildSight</a>
          <div className="nav-links">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} aria-current={page === n.id ? "page" : undefined}>{n.title}</a>
            ))}
          </div>
          <Status health={health} down={down} />
        </nav>
        <ScrollProgress />
      </header>
      <main className="content" id="main" tabIndex={-1}>
        {/* Keyed so each tool starts fresh and never shows another tool's results. */}
        <PageBoundary key={page}>
          {Page ? <div className="wrap"><Page key={page} param={param} /></div> : <Dashboard health={health} />}
        </PageBoundary>
      </main>
      <footer className="footer">
        <div className="wrap">
          <p>BuildSight gives decision support, not certified inspections or valuations. Have a qualified engineer confirm any real decision.</p>
          <p>Test photos are open-licensed and credited on the <a href="#testing">Testing</a> page. <a href="https://github.com/Atishay0425/multimodal-construction-intelligence-platform">View the source on GitHub</a>.</p>
        </div>
      </footer>
    </div>
  );
}
