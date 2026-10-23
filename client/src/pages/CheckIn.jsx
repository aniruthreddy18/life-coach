// =============================================================
// CheckIn.jsx — the evening check-in (a FORM).
// Controlled inputs: each input's value lives in React state.
// =============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Spinner } from "../components.jsx";

export default function CheckIn() {
  const [existing, setExisting] = useState(undefined); // undefined = still loading
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ mood: 6, energy: 6, wins: "", blockers: "" });
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/checkins/today").then((c) => {
      setExisting(c);
      if (c) setForm({ mood: c.mood, energy: c.energy, wins: c.wins ?? "", blockers: c.blockers ?? "" });
    }).catch((e) => setError(e.message));
    api("/dashboard").then((d) => setTasks(d.tasks)).catch(() => {});
  }, []);

  const update = (field) => (e) =>
    setForm({ ...form, [field]: e.target.type === "range" ? Number(e.target.value) : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const result = await api("/checkins", { method: "POST", body: form });
      setReply(result.reply);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (existing === undefined && !error) return <div className="center"><Spinner /></div>;

  const done = tasks.filter((t) => t.done).length;
  const shownReply = reply || existing?.coach_reply;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Evening check-in</p>
          <h1>How did today go?</h1>
        </div>
      </header>

      <div className="card">
        <p>
          You finished <b>{done}/{tasks.length}</b> tasks today.{" "}
          <Link to="/">Update tasks</Link>
        </p>
      </div>

      {shownReply && (
        <div className="card coach-bubble">
          <p className="eyebrow">Coach says</p>
          {shownReply}
        </div>
      )}

      <form className="card form" onSubmit={submit}>
        <label>
          <span>Mood: <b>{form.mood}/10</b></span>
          <input type="range" min="1" max="10" value={form.mood} onChange={update("mood")} />
        </label>
        <label>
          <span>Energy: <b>{form.energy}/10</b></span>
          <input type="range" min="1" max="10" value={form.energy} onChange={update("energy")} />
        </label>
        <label>
          What went well? 🏆
          <textarea className="input" rows={3} value={form.wins} onChange={update("wins")}
            placeholder="Finished 2 problems, understood recursion…" />
        </label>
        <label>
          What stopped you? (be honest) 🧱
          <textarea className="input" rows={3} value={form.blockers} onChange={update("blockers")}
            placeholder="Got distracted by Instagram for an hour…" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary wide" disabled={sending}>
          {sending ? "Coach is reading…" : existing || reply ? "Update check-in" : "Submit check-in"}
        </button>
      </form>
    </>
  );
}
