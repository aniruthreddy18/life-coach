// =============================================================
// Settings.jsx — account (sign out), appearance, AI usage & budget,
//                notifications, reset
// =============================================================
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  DesktopIcon, SunIcon, MoonIcon, CoinsIcon, BellIcon, ArrowCounterClockwiseIcon, BooksIcon, PaletteIcon,
  UserCircleIcon, SignOutIcon,
} from "@phosphor-icons/react";
import { api, enableNotifications } from "../api.js";
import { getTheme, setTheme } from "../theme.js";
import { Page, Card, Reveal, Button, AnimatedNumber, spring, softSpring } from "../components.jsx";

export default function Settings({ email, onSignOut, onReset }) {
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function enable() {
    setMsg("");
    try {
      await enableNotifications();
      setMsg("Notifications are on for this device.");
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function test() {
    const { sent } = await api("/push/test", { method: "POST" });
    setMsg(sent ? `Sent to ${sent} device(s). Check your notifications.` : "No devices subscribed yet. Enable them first.");
  }

  async function reset() {
    await api("/profile", { method: "DELETE" });
    onReset();
  }

  return (
    <Page>
      <Reveal className="page-head">
        <span className="label">App</span>
        <h1 className="display">Settings</h1>
      </Reveal>

      <AccountCard email={email} onSignOut={onSignOut} />

      <Card>
        <div className="card-head">
          <span className="card-title"><PaletteIcon size={18} weight="bold" /> Appearance</span>
        </div>
        <ThemePicker />
      </Card>

      <UsageCard />

      <Card>
        <div className="card-head">
          <span className="card-title"><BellIcon size={18} weight="bold" /> Notifications</span>
        </div>
        <p className="muted">
          Morning plan, evening check-in reminder, a firmer nudge if you skip, and the Sunday report.
          They're sent while the server is running.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <Button variant="primary" onClick={enable}>Turn on</Button>
          <Button onClick={test}>Send a test</Button>
        </div>
        {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
      </Card>

      <Card>
        <div className="card-head">
          <span className="card-title"><ArrowCounterClockwiseIcon size={18} weight="bold" /> Start over</span>
        </div>
        <p className="muted">Redo onboarding with fresh answers. This deletes your plan, tasks, chats and reports.</p>
        <div className="row" style={{ marginTop: 14 }}>
          <AnimatePresence mode="wait" initial={false}>
            {!confirming ? (
              <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button variant="danger" onClick={() => setConfirming(true)}>Reset everything</Button>
              </motion.div>
            ) : (
              <motion.div key="confirm" className="row" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <span className="error" style={{ fontWeight: 500 }}>Delete everything?</span>
                <Button variant="danger" onClick={reset}>Yes, delete</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </Page>
  );
}

// Who's signed in + the Sign out button
function AccountCard({ email, onSignOut }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <div className="card-head">
        <span className="card-title"><UserCircleIcon size={18} weight="bold" /> Account</span>
      </div>
      <div className="account">
        <span className="account-avatar" aria-hidden>{(email ?? "?")[0].toUpperCase()}</span>
        <div className="account-text">
          <span className="label">Signed in as</span>
          <strong>{email}</strong>
        </div>
        <Button
          onClick={async () => {
            setBusy(true);
            await onSignOut();
          }}
          disabled={busy}
        >
          <SignOutIcon size={16} weight="bold" /> {busy ? "Signing out…" : "Sign out"}
        </Button>
      </div>
      <p className="faint" style={{ fontSize: "0.83rem", marginTop: 12 }}>
        You stay signed in on this device until you sign out. Your plan and chats are saved to your account.
      </p>
    </Card>
  );
}

const THEMES = [
  { id: "light", label: "Light", icon: SunIcon },
  { id: "dark", label: "Dark", icon: MoonIcon },
  { id: "system", label: "System", icon: DesktopIcon },
];

function ThemePicker() {
  const [theme, setThemeState] = useState(getTheme());
  return (
    <div className="segmented" role="group" aria-label="Theme">
      {THEMES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          aria-pressed={theme === id}
          onClick={() => {
            setTheme(id);
            setThemeState(id);
          }}
        >
          {theme === id && <motion.span layoutId="theme-pill" className="seg-pill" transition={spring} />}
          <Icon size={16} weight={theme === id ? "fill" : "regular"} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

// =============================================================
// AI usage & budget — reads GET /api/usage
// =============================================================
function UsageCard() {
  const [u, setU] = useState(null);
  useEffect(() => {
    api("/usage").then(setU).catch(() => {});
  }, []);
  if (!u) return null;

  const toInr = (usd) => usd * u.inrPerUsd;
  const inr = (usd) => `₹${toInr(usd).toFixed(toInr(usd) < 1 ? 2 : 0)}`;
  const usedPct = u.budgetUsd ? Math.min(1, u.today.cost / u.budgetUsd) : 0;
  const lib = u.library;

  return (
    <Card>
      <div className="card-head">
        <span className="card-title"><CoinsIcon size={18} weight="bold" /> AI usage & budget</span>
        <span className="tag neutral">{u.aiEnabled ? u.provider : "AI off"}</span>
      </div>

      {u.aiEnabled ? (
        <>
          <span className="label">Spent today</span>
          <div className="usage-big">
            <span className="num">₹<AnimatedNumber value={toInr(u.today.cost)} decimals={2} /></span>
            <span className="muted">of {u.budgetUsd ? inr(u.budgetUsd) : "no limit"} · {u.today.calls} call(s)</span>
          </div>
          {u.budgetUsd > 0 && (
            <div className="meter" role="meter" aria-valuenow={Math.round(usedPct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Daily budget used">
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: usedPct }} transition={softSpring} />
            </div>
          )}
          <p className="faint" style={{ fontSize: "0.83rem", marginTop: 8 }}>
            smart: {u.models.smart} · fast: {u.models.fast}{u.models.free ? ` · free: ${u.models.free}` : ""}
          </p>
          {u.overBudget && <p className="error" style={{ marginTop: 8 }}>Budget reached. Using {u.models.free ? "the free model" : "free templates"} until tomorrow.</p>}
          {!u.aiStatus.ok && <p className="error" style={{ marginTop: 8 }}>Last AI call failed: {u.aiStatus.reason}</p>}
        </>
      ) : (
        <p className="muted">AI is off (<code>AI_PROVIDER=none</code>). Everything runs on free rules and templates.</p>
      )}

      <table className="usage-table">
        <tbody>
          <tr><td>Last 7 days</td><td>{inr(u.last7.reduce((s, d) => s + d.cost, 0))} · {u.last7.reduce((s, d) => s + d.calls, 0)} calls</td></tr>
          <tr><td>All time</td><td>{inr(u.allTime.cost)} · {u.allTime.calls} calls</td></tr>
          {u.byFeature.map((f) => (
            <tr key={f.feature} className="sub"><td>· {f.feature}</td><td>{inr(f.cost)} · {f.calls}</td></tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, fontSize: "0.92rem" }}>
        <BooksIcon size={16} weight="duotone" color="var(--accent)" /> Free content library
      </h4>
      <div className="lib-grid">
        <div><span className="num"><AnimatedNumber value={lib.questions} /></span><span className="label">quiz questions</span></div>
        <div><span className="num"><AnimatedNumber value={lib.roadmaps.uses} /></span><span className="label">roadmap reuses</span></div>
        <div><span className="num"><AnimatedNumber value={lib.explanations.hits} /></span><span className="label">answers reused</span></div>
      </div>
    </Card>
  );
}
