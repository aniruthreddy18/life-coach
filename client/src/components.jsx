// =============================================================
// components.jsx — small reusable UI pieces.
// A "component" is a function that returns UI. Write once, use anywhere.
// =============================================================
import { useState } from "react";

export function Spinner({ text }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" />
      {text && <p className="muted">{text}</p>}
    </div>
  );
}

export function StatTile({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

// Horizontal meters for the 6 AI scores (0-100)
export function ScoreBars({ scores }) {
  return (
    <div className="scores">
      {scores.map((s) => (
        <div className="score" key={s.name} title={s.reason}>
          <div className="score-head">
            <span>{s.name}</span>
            <b>{s.value}</b>
          </div>
          <div className="meter" role="meter" aria-valuenow={s.value} aria-valuemin={0} aria-valuemax={100} aria-label={s.name}>
            <div style={{ width: `${s.value}%` }} />
          </div>
          <p className="score-reason">{s.reason}</p>
        </div>
      ))}
    </div>
  );
}

// 14-day bar chart: % of tasks done per day. Hover/tap a bar for details.
export function CompletionChart({ stats }) {
  const [active, setActive] = useState(null);
  const shown = active ?? stats[stats.length - 1];
  const pct = (d) => (d.total ? Math.round((d.done / d.total) * 100) : 0);
  const label = (date) =>
    new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

  return (
    <div>
      <div className="chart-readout">
        <b>{label(shown.date)}</b>: {shown.total ? `${shown.done}/${shown.total} tasks (${pct(shown)}%)` : "no tasks"}
        {shown.mood ? ` · mood ${shown.mood}/10` : ""}
      </div>
      <div className="bars" onMouseLeave={() => setActive(null)} role="img"
        aria-label={stats.map((d) => `${d.date}: ${d.done} of ${d.total} tasks`).join("; ")}>
        {stats.map((d) => (
          <button
            key={d.date}
            className={"bar-slot" + (active?.date === d.date ? " active" : "")}
            onMouseEnter={() => setActive(d)}
            onFocus={() => setActive(d)}
            onClick={() => setActive(d)}
            aria-label={`${label(d.date)}: ${d.done} of ${d.total} tasks done`}
          >
            <span className="bar" style={{ height: `${Math.max(pct(d), d.total ? 3 : 0)}%` }} />
          </button>
        ))}
      </div>
      <div className="bars-axis">
        <span>{label(stats[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
