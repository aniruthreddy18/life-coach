// =============================================================
// App.jsx — the app's skeleton
// 1. On start, ask the backend: "do we have a profile?"
// 2. No  -> show onboarding.
// 3. Yes -> show the main app with a bottom navigation bar,
//           and pick the page based on the URL (React Router).
// =============================================================
import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { api } from "./api.js";
import Onboarding from "./pages/Onboarding.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Chat from "./pages/Chat.jsx";
import CheckIn from "./pages/CheckIn.jsx";
import Roadmap from "./pages/Roadmap.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  // "state" = data that, when it changes, makes React re-draw the screen
  const [status, setStatus] = useState("loading"); // loading | onboarding | ready | error
  const [error, setError] = useState("");

  // useEffect with [] runs once, when the app first appears
  useEffect(() => {
    api("/profile")
      .then(() => setStatus("ready"))
      .catch((err) => {
        if (err.status === 404) setStatus("onboarding");
        else {
          setError("Can't reach the server. Is it running? (npm run dev)");
          setStatus("error");
        }
      });
  }, []);

  if (status === "loading") return <div className="center muted">Loading…</div>;
  if (status === "error") return <div className="center error">{error}</div>;
  if (status === "onboarding") return <Onboarding onDone={() => setStatus("ready")} />;

  return (
    <div className="app">
      <main className="page">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings onReset={() => setStatus("onboarding")} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="tabbar">
        <Tab to="/" icon="🏠" label="Today" />
        <Tab to="/chat" icon="💬" label="Coach" />
        <Tab to="/checkin" icon="✅" label="Check-in" />
        <Tab to="/roadmap" icon="🗺️" label="Plan" />
        <Tab to="/reports" icon="📊" label="Reports" />
      </nav>
    </div>
  );
}

function Tab({ to, icon, label }) {
  return (
    <NavLink to={to} end className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
      <span className="tab-icon" aria-hidden>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
