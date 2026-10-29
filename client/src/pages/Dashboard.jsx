// =============================================================
// Dashboard.jsx — the "Today" screen
// Loads /api/dashboard. If today has no tasks yet, asks
// /api/tasks/today, which plans the week (AI or rules).
// =============================================================
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  FireIcon, TargetIcon, SmileyIcon, ListChecksIcon, ChartBarIcon, PulseIcon, QuotesIcon, ArrowRightIcon,
  WarningIcon, CalendarCheckIcon, SparkleIcon, ArrowSquareOutIcon, PlayCircleIcon,
} from "@phosphor-icons/react";
import { api } from "../api.js";
import {
  Page, Card, Reveal, Ring, Check, StatTile, ScoreBars, CompletionChart, PageSkeleton, Skeleton, Button,
  celebrate, spring, itemVariants,
} from "../components.jsx";

const DIFFICULTY_TAG = { Easy: "good", Medium: "", Hard: "bad" };
const shortDate = (d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [morningMsg, setMorningMsg] = useState("");
  const [error, setError] = useState("");
  const wasAllDone = useRef(null);

  async function load() {
    try {
      const d = await api("/dashboard");
      setData(d);
      if (!d.plannedToday) planToday(); // new day: carry over the backlog + plan today
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

  useEffect(() => {
    load();
  }, []);

  // Confetti the moment the LAST task of the day gets ticked
  useEffect(() => {
    if (!data?.tasks.length) return;
    const allDone = data.tasks.every((t) => t.done);
    if (wasAllDone.current === false && allDone) celebrate();
    wasAllDone.current = allDone;
  }, [data?.tasks]);

  async function toggle(task) {
    // "Optimistic update": change the screen first, then tell the server.
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)) }));
    try {
      await api(`/tasks/${task.id}`, { method: "PATCH", body: { done: !task.done } });
      const fresh = await api("/dashboard");
      setData((d) => ({ ...fresh, tasks: d.tasks.map((t) => fresh.tasks.find((f) => f.id === t.id) ?? t) }));
    } catch (e) {
      setError(e.message);
      load(); // undo by reloading the truth from the server
    }
  }

  if (error && !data) return <div className="center error">{error}</div>;
  if (!data) return <PageSkeleton />;

  const done = data.tasks.filter((t) => t.done).length;
  const total = data.tasks.length;
  const carried = data.tasks.filter((t) => t.from_date).length; // backlog from earlier days
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  // Unfinished tasks first; finished ones glide to the bottom (layout animation)
  const sorted = [...data.tasks].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Page wide>
      <AIBanner ai={data.ai} />

      <div className="bento">
        <Card className="glow hero area-hero">
          <span className="label">{greeting}</span>
          <h1 className="display">
            Let's go, <em>{data.name}</em>.
          </h1>
          <div className="hero-meta">
            {data.milestone && (
              <span className="tag">
                <CalendarCheckIcon size={14} weight="bold" /> Week {data.milestone.week_number} of 12
              </span>
            )}
            {data.milestone && <span className="tag neutral">{data.milestone.title}</span>}
          </div>
        </Card>

        <Card className="area-today today-card">
          <Ring value={total ? done / total : 0} size={96}>
            <span className="num" style={{ fontSize: "1.3rem" }}>
              {done}/{total || "–"}
            </span>
          </Ring>
          <div className="today-copy">
            <span className="label">Today</span>
            <strong>{total && done === total ? "All done. Proud of you." : total ? `${total - done} to go` : "Planning…"}</strong>
            {!data.checkedInToday && hour >= 17 ? (
              <Link to="/checkin" className="muted" style={{ fontSize: "0.9rem" }}>
                Do tonight's check-in →
              </Link>
            ) : (
              <span className="muted" style={{ fontSize: "0.9rem" }}>{data.milestone?.focus}</span>
            )}
          </div>
        </Card>

        <Card className="area-tasks">
          <div className="card-head">
            <h2 className="card-title"><ListChecksIcon size={18} weight="bold" /> Today's tasks</h2>
            <span className="num faint">{done}/{total}</span>
          </div>
          {carried > 0 && (
            <p className="backlog-note">
              <strong>{total - carried} new + {carried} from earlier.</strong> Unfinished work moves to the next day, so no concept is skipped. Clear the backlog first.
            </p>
          )}

          <AnimatePresence>
            {morningMsg && (
              <motion.div className="quote" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <QuotesIcon size={18} weight="fill" />
                <span>{morningMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {planning && (
            <div className="tasks" aria-busy="true">
              <p className="muted" style={{ marginBottom: 6 }}>
                <SparkleIcon size={14} weight="fill" style={{ verticalAlign: "-2px" }} /> Getting today's tasks ready…
              </p>
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          )}
          {!planning && total === 0 && <Button onClick={planToday}>Plan my day</Button>}

          <motion.ul className="tasks" layout>
            <AnimatePresence initial={false}>
              {sorted.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  transition={spring}
                  className={`task ${t.done ? "done" : ""}`}
                  onClick={() => toggle(t)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Check checked={t.done} onChange={() => toggle(t)} label={`Mark "${t.title}" as ${t.done ? "not done" : "done"}`} />
                  <div className="task-body">
                    <span className="task-title">
                      {t.title}
                      <motion.span
                        className="task-strike"
                        initial={false}
                        animate={{ scaleX: t.done ? 1 : 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </span>
                    {(t.from_date || t.difficulty || t.topic) && (
                      <span className="task-tags">
                        {t.from_date && <span className="tag bad">Backlog · from {shortDate(t.from_date)}</span>}
                        {t.difficulty && <span className={`tag ${DIFFICULTY_TAG[t.difficulty] ?? "neutral"}`}>{t.difficulty}</span>}
                        {t.topic && <span className="tag neutral">{t.topic}</span>}
                      </span>
                    )}
                    <span className="task-meta">
                      {t.details} · <span className="num">{t.minutes} min</span>
                    </span>
                    {(t.link || t.video) && (
                      // stopPropagation: tapping a link opens it, it doesn't tick the task
                      <span className="task-links" onClick={(e) => e.stopPropagation()}>
                        {t.link && (
                          <a className="btn primary sm" href={t.link} target="_blank" rel="noopener noreferrer">
                            {t.link.includes("lintcode.com") ? "Solve free on LintCode" : "Solve on LeetCode"} <ArrowSquareOutIcon size={14} weight="bold" />
                          </a>
                        )}
                        {t.video && (
                          <a className="btn ghost sm" href={t.video} target="_blank" rel="noopener noreferrer">
                            <PlayCircleIcon size={16} weight="fill" /> Stuck? Watch solution
                          </a>
                        )}
                      </span>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
        </Card>

        <div className="area-side">
          <motion.div className="stat-grid" variants={itemVariants}>
            <StatTile icon={FireIcon} label="Streak" value={data.streak} suffix="d" />
            <StatTile icon={TargetIcon} label="This week" value={data.completionRate} suffix="%" />
            <StatTile icon={SmileyIcon} label="Mood" value={data.avgMood} decimals={1} />
          </motion.div>

          <Card>
            <div className="card-head">
              <h2 className="card-title"><PulseIcon size={18} weight="bold" /> Your scores</h2>
              <span className="tag neutral">live</span>
            </div>
            <ScoreBars scores={data.liveScores} />
          </Card>
        </div>

        <Card className="area-chart">
          <div className="card-head">
            <h2 className="card-title"><ChartBarIcon size={18} weight="bold" /> Last 14 days</h2>
          </div>
          <CompletionChart stats={data.stats} />
        </Card>
      </div>
    </Page>
  );
}

// Tells you when the coach is running without AI, and why
function AIBanner({ ai }) {
  if (!ai) return null;
  let text = null;
  if (!ai.enabled) text = "Free mode: plans and replies come from rules and templates.";
  else if (ai.overBudget) text = "Today's AI budget is used up. The coach uses free templates until tomorrow.";
  else if (!ai.ok) text = `Coach is in offline mode: ${ai.reason}`;
  if (!text) return null;
  return (
    <Reveal>
      <Link to="/settings" className="banner">
        <WarningIcon size={18} weight="duotone" />
        <span>{text}</span>
        <ArrowRightIcon size={16} className="arrow" />
      </Link>
    </Reveal>
  );
}
