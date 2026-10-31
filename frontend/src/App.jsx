import { useEffect, useState } from "react";
import Dashboard, { MODULES } from "./pages/Dashboard.jsx";
import { AssistantPage, CracksPage, SafetyPage } from "./pages/ImagePages.jsx";
import { PlanningPage, ValuationPage } from "./pages/PlanningPages.jsx";
import KnowledgePage from "./pages/KnowledgePage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import Login from "./components/Login.jsx";
import { getHealth } from "./api.js";

const PAGES = {
  safety: SafetyPage, cracks: CracksPage, valuation: ValuationPage, planning: PlanningPage,
  assistant: AssistantPage, knowledge: KnowledgePage, history: HistoryPage,
};

export default function App() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "dashboard");
  const [page, param] = route.split("/");
  useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    getHealth().then((h) => setLocked(h.auth_required && !h.authenticated)).catch(() => {});
    const lock = () => setLocked(true);
    window.addEventListener("auth-required", lock);
    return () => window.removeEventListener("auth-required", lock);
  }, []);
  const go = (p) => { location.hash = p; window.scrollTo(0, 0); };
  const Page = PAGES[page];
  if (locked) return <Login onDone={() => setLocked(false)} />;
  const nav = [{ id: "dashboard", icon: "▦", title: "Dashboard" }, ...MODULES, { id: "history", icon: "🕘", title: "History" }];
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand"><span className="brand-mark">▲</span> BuildSight</div>
        {nav.map((n) => (
          <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
            <span aria-hidden>{n.icon}</span> {n.title}
          </button>
        ))}
      </nav>
      <main className="content">
        {/* Keyed so each module starts fresh and never shows another module's results. */}
        {Page ? <Page key={page} param={param} /> : <Dashboard go={go} />}
      </main>
    </div>
  );
}
