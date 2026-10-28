// =============================================================
// App.jsx — the app's skeleton
// 1. Load the sign-in settings, then: are you signed in?
//      No  -> the sign-in screen (email + code).
// 2. Signed in: ask the backend "do I have a profile?"
//      No (404) -> FIRST time: the 12 questions (onboarding).
//      Yes      -> straight into the app, with a funny hello.
// 3. You stay signed in (even after closing the browser) until you
//    press Sign out in Settings.
// AnimatePresence lets the OLD page animate out before the NEW
// page animates in (that's what makes page changes feel smooth).
// =============================================================
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, NavLink, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  HouseIcon, ChatCircleDotsIcon, CheckCircleIcon, MapTrifoldIcon, ChartBarIcon, GearSixIcon, WifiSlashIcon, XIcon, WrenchIcon,
} from "@phosphor-icons/react";
import { api, setUnauthorizedHandler, disableNotificationsHere } from "./api.js";
import { initAuth, getSession, signOut as endSession, onSignedOut, authMode } from "./auth.js";
import { PageSkeleton, spring, softSpring } from "./components.jsx";
import SignIn from "./pages/SignIn.jsx";
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
  const [status, setStatus] = useState("loading"); // loading | signedOut | onboarding | ready | error | config
  const [user, setUser] = useState(null);
  const [hello, setHello] = useState(null);
  const saidHello = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Signed in -> first time (onboarding) or straight into the app?
  const routeSignedIn = useCallback(async (session) => {
    setUser(session.user);
    setStatus("loading");
    try {
      await api("/profile");
      setStatus("ready");
    } catch (err) {
      if (err.status === 404) setStatus("onboarding");
      else if (err.status !== 401) setStatus("error"); // 401 -> signOut() already sent us to sign-in
    }
  }, []);

  const signOut = useCallback(async () => {
    await disableNotificationsHere();
    await endSession(); // this device only
    saidHello.current = false;
    setHello(null);
    setUser(null);
    setStatus("signedOut");
    navigate("/", { replace: true }); // next sign-in starts on "Today"
  }, [navigate]);

  // useEffect with [] runs once, when the app first appears
  useEffect(() => {
    // The server said "who are you?" -> the session is dead, sign in again
    setUnauthorizedHandler(() => {
      endSession();
      setStatus("signedOut");
    });
    let unsubscribe = () => {};
    initAuth()
      .then(async () => {
        const session = await getSession(); // saved in this browser?
        if (session) routeSignedIn(session);
        else setStatus("signedOut");
        // Signed out in another tab
        unsubscribe = onSignedOut(() => setStatus("signedOut"));
      })
      .catch((err) => setStatus(err.kind === "config" ? "config" : "error"));
    return () => unsubscribe();
  }, [routeSignedIn]);

  // Every time the app opens: one funny hello (the server counts the opens)
  useEffect(() => {
    if (status !== "ready" || saidHello.current) return;
    saidHello.current = true;
    api("/hello", { method: "POST" }).then(setHello).catch(() => {});
  }, [status]);

  return (
    // reducedMotion="user": respect the phone's "reduce motion" setting
    <MotionConfig reducedMotion="user" transition={spring}>
      <a href="#main" className="skip-link">Skip to content</a>
      <Suspense fallback={<PageSkeleton />}>
      {status === "loading" && <PageSkeleton />}
      {status === "error" && <ServerDown />}
      {status === "config" && <NotConfigured />}
      {status === "signedOut" && <SignIn mode={authMode()} onSignedIn={routeSignedIn} />}
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
              <Route
                path="/settings"
                element={<Settings email={user?.email} onSignOut={signOut} onReset={() => setStatus("onboarding")} />}
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AnimatePresence>
          <Dock />
          <Greeting hello={hello} onClose={() => setHello(null)} />
        </div>
      )}
      </Suspense>
    </MotionConfig>
  );
}

// The "Hii bro, ela unnav?" card: drops in from the top, leaves after a few seconds
function Greeting({ hello, onClose }) {
  useEffect(() => {
    if (!hello) return;
    const t = setTimeout(onClose, 6500);
    return () => clearTimeout(t);
  }, [hello, onClose]);

  return (
    <AnimatePresence>
      {hello && (
        <motion.div
          className="greeting"
          role="status"
          initial={{ opacity: 0, y: -40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { ...softSpring, delay: 0.35 } }}
          exit={{ opacity: 0, y: -30, scale: 0.95, transition: { duration: 0.2 } }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(e, info) => info.offset.y < -30 && onClose()}
        >
          <motion.span
            className="greeting-wave"
            aria-hidden
            animate={{ rotate: [0, 18, -8, 18, 0] }}
            transition={{ duration: 1.2, delay: 0.7 }}
          >
            👋
          </motion.span>
          <div className="greeting-text">
            <span className="label">Coach</span>
            <p>{hello.message}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
          <motion.i
            className="greeting-timer"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 6.1, delay: 0.4, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
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

function NotConfigured() {
  return (
    <div className="center">
      <div className="empty">
        <div className="empty-icon"><WrenchIcon size={26} weight="duotone" /></div>
        <h3>Sign-in isn't set up yet</h3>
        <p className="muted">
          Add <code>SUPABASE_URL</code> and <code>SUPABASE_PUBLISHABLE_KEY</code> to <code>server/.env</code>,
          run <code>npm run doctor</code> in the server folder, then restart.
        </p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    </div>
  );
}

function ServerDown() {
  return (
    <div className="center">
      <div className="empty">
        <div className="empty-icon"><WifiSlashIcon size={26} weight="duotone" /></div>
        <h3>Can't reach the server</h3>
        <p className="muted">Start it in your terminal with <code>npm run dev</code> (or run <code>npm run doctor</code> in the server folder to see what's wrong), then reload this page.</p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    </div>
  );
}
