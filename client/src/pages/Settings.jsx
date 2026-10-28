// =============================================================
// Settings.jsx — AI usage & budget, notifications, reset
// =============================================================
import { useEffect, useState } from "react";
import { api, enableNotifications } from "../api.js";

export default function Settings({ onReset }) {
  const [msg, setMsg] = useState("");

  async function enable() {
    setMsg("");
    try {
      await enableNotifications();
      setMsg("✅ Notifications enabled on this device.");
    } catch (e) {
      setMsg("⚠️ " + e.message);
    }
  }

  async function test() {
    const { sent } = await api("/push/test", { method: "POST" });
    setMsg(sent ? `Sent to ${sent} device(s). Check your notifications!` : "No devices subscribed yet — enable first.");
  }

  async function reset() {
    if (!confirm("Delete ALL your data (profile, plan, tasks, chats, reports) and start over?")) return;
    await api("/profile", { method: "DELETE" });
    onReset();
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">App</p>
          <h1>Settings</h1>
        </div>
      </header>

      <UsageCard />

      <section className="card">
        <h3>🔔 Notifications</h3>
        <p className="muted">
          Morning plan, evening check-in reminder, a stricter nudge if you skip, and a Sunday report.
          The server must be running for notifications to be sent.
        </p>
        <div className="row">
          <button className="btn primary" onClick={enable}>Enable on this device</button>
          <button className="btn" onClick={test}>Send test</button>
        </div>
        {msg && <p>{msg}</p>}
      </section>

      <section className="card">
        <h3>🧨 Start over</h3>
        <p className="muted">Redo onboarding with fresh answers. This deletes everything.</p>
        <button className="btn danger" onClick={reset}>Reset everything</button>
      </section>
    </>
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

  const inr = (usd) => `₹${(usd * u.inrPerUsd).toFixed(usd * u.inrPerUsd < 1 ? 2 : 0)}`;
  const usedPct = u.budgetUsd ? Math.min(100, Math.round((u.today.cost / u.budgetUsd) * 100)) : 0;
  const lib = u.library;

  return (
    <section className="card">
      <h3>💰 AI usage & budget</h3>
      <p className="muted">
        {u.aiEnabled
          ? <>Provider: <b>{u.provider}</b> · smart: {u.models.smart} · fast: {u.models.fast}{u.models.free ? ` · free: ${u.models.free}` : ""}</>
          : <>AI is <b>off</b> (AI_PROVIDER=none). Everything runs on free rules and templates.</>}
      </p>

      {u.aiEnabled && (
        <>
          <div className="score-head">
            <span>Today: {inr(u.today.cost)} of {u.budgetUsd ? inr(u.budgetUsd) : "no limit"}</span>
            <b>{u.today.calls} AI call(s)</b>
          </div>
          {u.budgetUsd > 0 && (
            <div className="meter" role="meter" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Daily budget used">
              <div style={{ width: `${usedPct}%` }} />
            </div>
          )}
          {u.overBudget && <p className="error">Budget reached — {u.models.free ? "using the free model" : "using free templates"} until tomorrow.</p>}
          {!u.aiStatus.ok && <p className="error">Last AI call failed: {u.aiStatus.reason}</p>}
        </>
      )}

      <table className="usage-table">
        <tbody>
          <tr><td>Last 7 days</td><td>{inr(u.last7.reduce((s, d) => s + d.cost, 0))} · {u.last7.reduce((s, d) => s + d.calls, 0)} calls</td></tr>
          <tr><td>All time</td><td>{inr(u.allTime.cost)} · {u.allTime.calls} calls</td></tr>
          {u.byFeature.map((f) => (
            <tr key={f.feature}><td className="muted">· {f.feature}</td><td className="muted">{inr(f.cost)} · {f.calls}</td></tr>
          ))}
        </tbody>
      </table>

      <h4>📚 Free content library</h4>
      <p className="muted">
        {lib.questions} level-test questions ({lib.aiQuestions} written by AI, reused for free) ·
        {" "}{lib.roadmaps.n} saved roadmap(s), used {lib.roadmaps.uses}× ·
        {" "}{lib.explanations.n} saved explanation(s), reused {lib.explanations.hits}×
      </p>
    </section>
  );
}
