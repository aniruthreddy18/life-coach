// =============================================================
// Roadmap.jsx — your 12-week plan + what the AI thinks of you.
// =============================================================
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Spinner } from "../components.jsx";

export default function Roadmap() {
  const [profile, setProfile] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);

  useEffect(() => {
    api("/profile").then(setProfile);
    api("/dashboard").then((d) => setCurrentWeek(d.milestone?.week_number));
  }, []);

  if (!profile) return <div className="center"><Spinner /></div>;
  const a = profile.assessment;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Your plan</p>
          <h1>12-week roadmap</h1>
        </div>
      </header>

      <div className="card">
        <h3>Where you started</h3>
        <p>{a.summary}</p>
        <p className="muted">Level: {a.level} · Baseline quiz: {profile.quiz_score}/100</p>
      </div>

      <ol className="timeline">
        {profile.roadmap.map((w) => (
          <li key={w.id} className={w.week_number === currentWeek ? "current" : w.week_number < currentWeek ? "past" : ""}>
            <p className="eyebrow">Week {w.week_number}{w.week_number === currentWeek ? " · you are here" : ""}</p>
            <h3>{w.title}</h3>
            <p className="muted">{w.focus}</p>
            <ul>{w.goals.map((g) => <li key={g}>{g}</li>)}</ul>
          </li>
        ))}
      </ol>
    </>
  );
}
