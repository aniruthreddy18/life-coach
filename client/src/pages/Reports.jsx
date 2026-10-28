// =============================================================
// Reports.jsx — weekly reports (auto-made every Sunday 8 PM,
// or generate one now with the button).
// =============================================================
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChartLineUpIcon, TrophyIcon, WarningIcon, TargetIcon, SparkleIcon } from "@phosphor-icons/react";
import { api } from "../api.js";
import { Page, Reveal, Button, Empty, Skeleton, softSpring, itemVariants } from "../components.jsx";

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api("/reports").then(setReports).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

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
    <Page>
      <Reveal className="page-head">
        <span className="label">Weekly</span>
        <h1 className="display">The <em>honest</em> report.</h1>
        <p>Every Sunday at 8 PM your coach grades the week. Or make one now.</p>
      </Reveal>

      <Reveal>
        <Button variant="primary" className="wide lg" onClick={generate} disabled={busy}>
          <SparkleIcon size={18} weight="fill" />
          {busy ? "Writing your report…" : "Generate this week's report"}
        </Button>
      </Reveal>
      {error && <p className="error">{error}</p>}

      <AnimatePresence>{busy && <motion.div exit={{ opacity: 0 }}><Skeleton height={260} /></motion.div>}</AnimatePresence>

      {reports === null && <Skeleton height={260} />}
      {reports?.length === 0 && !busy && (
        <Reveal className="card">
          <Empty icon={ChartLineUpIcon} title="No reports yet">
            Your first one arrives on Sunday evening. Do a few check-ins this week so there's something to grade.
          </Empty>
        </Reveal>
      )}

      <AnimatePresence initial={false}>
        {reports?.map((r) => {
          const c = r.content;
          return (
            <motion.article
              key={r.id}
              className="card"
              layout
              variants={itemVariants}
              initial="hidden"
              animate="show"
              transition={softSpring}
            >
              <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 16 }}>
                <motion.div
                  className={`grade grade-${c.grade}`}
                  initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
                >
                  {c.grade}
                </motion.div>
                <div>
                  <span className="label">Week of {r.week_start}</span>
                  <h2 style={{ fontSize: "1.2rem", marginTop: 2 }}>{c.headline}</h2>
                  <p className="muted" style={{ fontSize: "0.92rem", marginTop: 4 }}>{c.summary}</p>
                </div>
              </div>

              <div className="report-cols">
                <div>
                  <h4><TrophyIcon size={16} weight="duotone" color="var(--good)" /> Wins</h4>
                  <ul>{c.wins.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div>
                  <h4><WarningIcon size={16} weight="duotone" color="var(--bad)" /> Problems</h4>
                  <ul>{c.problems.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
              <div className="report-cols">
                <div>
                  <h4><TargetIcon size={16} weight="duotone" color="var(--accent)" /> Next week</h4>
                  <ul>{c.next_week_focus.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
              <blockquote className="letter" style={{ margin: "18px 0 0" }}>{c.coach_letter}</blockquote>
            </motion.article>
          );
        })}
      </AnimatePresence>
    </Page>
  );
}
