// =============================================================
// Reports.jsx — weekly reports (auto-made every Sunday 8 PM,
// or generate one now with the button).
// =============================================================
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Spinner } from "../components.jsx";

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api("/reports").then(setReports).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      await api("/reports", { method: "POST" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Weekly</p>
          <h1>Reports</h1>
        </div>
      </header>

      <button className="btn primary wide" onClick={generate} disabled={busy}>
        {busy ? "Writing your report…" : "Generate this week's report"}
      </button>
      {busy && <Spinner />}
      {error && <p className="error">{error}</p>}
      {reports?.length === 0 && <p className="muted center-text">No reports yet. One is created automatically every Sunday evening.</p>}

      {reports?.map((r) => {
        const c = r.content;
        return (
          <article className="card report" key={r.id}>
            <div className="card-head">
              <p className="eyebrow">Week of {r.week_start}</p>
              <span className={`grade grade-${c.grade}`}>{c.grade}</span>
            </div>
            <h3>{c.headline}</h3>
            <p>{c.summary}</p>
            <div className="grid2">
              <div><h4>✅ Wins</h4><ul>{c.wins.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h4>⚠️ Problems</h4><ul>{c.problems.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
            <h4>🎯 Next week</h4>
            <ul>{c.next_week_focus.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="coach-bubble">{c.coach_letter}</div>
          </article>
        );
      })}
    </>
  );
}
