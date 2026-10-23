// =============================================================
// Settings.jsx — notifications + reset
// =============================================================
import { useState } from "react";
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
