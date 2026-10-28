// =============================================================
// App.jsx — the app's skeleton
// 1. On start, ask the backend: "do we have a profile?"
// 2. No  -> show onboarding.
// 3. Yes -> top bar + the current page + a floating dock.
//    AnimatePresence lets the OLD page animate out before the NEW
//    page animates in (that's what makes page changes feel smooth).
// =============================================================
import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, Link, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  HouseIcon, ChatCircleDotsIcon, CheckCircleIcon, MapTrifoldIcon, ChartBarIcon, GearSixIcon, WifiSlashIcon,
} from "@phosphor-icons/react";
import { api } from "./api.js";
import { PageSkeleton, spring } from "./components.jsx";
// CODE SPLITTING: each page is downloaded only when it's first needed,
// so the app opens faster (onboarding is only ever loaded once).
const Onboarding = lazy(() => import("./pages/Onboarding.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Chat = lazy(() => import("./pages/Chat.jsx"));
const CheckIn = lazy(() => import("./pages/CheckIn.jsx"));
const Roadmap = lazy(() => import("./pages/Roadmap.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));

const TABS = [
  { to: "/", icon: HouseIcon, label: "Today" },
  { to: "/chat", icon: ChatCircleDotsIcon, label: "Coach" },
  { to: "/checkin", icon: CheckCircleIcon, label: "Check-in" },
  { to: "/roadmap", icon: MapTrifoldIcon, label: "Plan" },
  { to: "/reports", icon: ChartBarIcon, label: "Reports" },
];

export default function App() {
  // "state" = data that, when it changes, makes React re-draw the screen
  const [status, setStatus] = useState("loading"); // loading | onboarding | ready | error
  const location = useLocation();

  // useEffect with [] runs once, when the app first appears
  useEffect(() => {
    api("/profile")
      .then(() => setStatus("ready"))
      .catch((err) => setStatus(err.status === 404 ? "onboarding" : "error"));
  }, []);

  return (
    // reducedMotion="user": respect the phone's "reduce motion" setting
    <MotionConfig reducedMotion="user" transition={spring}>
      <a href="#main" className="skip-link">Skip to content</a>
      <Suspense fallback={<PageSkeleton />}>
      {status === "loading" && <PageSkeleton />}
      {status === "error" && <ServerDown />}
      {status === "onboarding" && <Onboarding onDone={() => setStatus("ready")} />}
      {status === "ready" && (
        <div className="shell">
          <TopBar />
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/checkin" element={<CheckIn />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings onReset={() => setStatus("onboarding")} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AnimatePresence>
          <Dock />
        </div>
      )}
      </Suspense>
    </MotionConfig>
  );
}

function TopBar() {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Life Coach home">
        <span className="brand-mark" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 12 L6 7.5 L9 10 L14 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="brand-name">Life Coach</span>
      </Link>
      <div className="topbar-right">
        <span className="label" style={{ marginRight: 4 }}>{today}</span>
        <NavLink to="/settings" className={({ isActive }) => `icon-btn ${isActive ? "active" : ""}`} aria-label="Settings">
          <GearSixIcon size={20} />
        </NavLink>
      </div>
    </header>
  );
}

// Floating glass dock. The highlighted "pill" is ONE element shared
// between tabs (layoutId), so it slides from tab to tab.
function Dock() {
  return (
    <nav className="dock" aria-label="Main">
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `dock-item ${isActive ? "active" : ""}`}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="dock-pill" className="dock-pill" transition={spring} />}
              <Icon size={22} weight={isActive ? "fill" : "regular"} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function ServerDown() {
  return (
    <div className="center">
      <div className="empty">
        <div className="empty-icon"><WifiSlashIcon size={26} weight="duotone" /></div>
        <h3>Can't reach the server</h3>
        <p className="muted">Start it in your terminal with <code>npm start</code>, then reload this page.</p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    </div>
  );
}
