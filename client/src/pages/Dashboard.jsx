// =============================================================
// Dashboard.jsx — the "Today" screen
// Loads /api/dashboard. If today has no tasks yet, asks
// /api/tasks/today, which makes the AI plan your day.
// =============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { CompletionChart, ScoreBars, Spinner, StatTile } from "../components.jsx";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [morningMsg, setMorningMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const d = await api("/dashboard");
      setData(d);
      if (d.tasks.length === 0) planToday();
    } catch (e) {
      setError(e.message);
    }
  }

  async function planToday() {
    setPlanning(true);
    try {
      const { tasks, message } = await api("/tasks/today");
      setData((d) => ({ ...d, tasks }));
      if (message) setMorningMsg(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setPlanning(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(task) {
    // "Optimistic update": change the screen first, then tell the server.
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)) }));
    try {
      await api(`/tasks/${task.id}`, { method: "PATCH", body: { done: !task.done } });
      const fresh = await api("/dashboard");
      setData(fresh);
    } catch (e) {
      setError(e.message);
      load(); // undo by reloading the truth from the server
    }
  }

  if (error && !data) return <div className="center error">{error}</div>;
  if (!data) return <div className="center"><Spinner /></div>;

  const done = data.tasks.filter((t) => t.done).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{greeting}</p>
          <h1>{data.name} 👋</h1>
        </div>
        <Link to="/settings" className="icon-btn" aria-label="Settings">⚙️</Link>
      </header>

      {data.milestone && (
        <div className="card week">
          <p className="eyebrow">Week {data.milestone.week_number} of 12</p>
          <h3>{data.milestone.title}</h3>
          <p className="muted">{data.milestone.focus}</p>
        </div>
      )}

      <div className="stats">
        <StatTile label="Day streak" value={`🔥 ${data.streak}`} />
        <StatTile label="Done (7 days)" value={data.completionRate != null ? `${data.completionRate}%` : null} />
        <StatTile label="Avg mood" value={data.avgMood} />
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Today's tasks</h3>
          <span className="muted">{done}/{data.tasks.length}</span>
        </div>
        {morningMsg && <div className="coach-bubble small">{morningMsg}</div>}
        {planning && <Spinner text="Coach is planning your day…" />}
        {!planning && data.tasks.length === 0 && (
          <button className="btn" onClick={planToday}>Plan my day</button>
        )}
        <ul className="tasks">
          {data.tasks.map((t) => (
            <li key={t.id} className={t.done ? "done" : ""}>
              <label>
                <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
                <span>
                  <b>{t.title}</b>
                  <small>{t.details} · {t.minutes} min</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="error">{error}</p>}
      </section>

      {!data.checkedInToday && hour >= 17 && (
        <Link to="/checkin" className="btn primary wide">Do tonight's check-in →</Link>
      )}

      <section className="card">
        <h3>Last 14 days</h3>
        <CompletionChart stats={data.stats} />
      </section>

      <section className="card">
        <h3>Your baseline scores</h3>
        <ScoreBars scores={data.assessment.scores} />
      </section>
    </>
  );
}
