// =============================================================
// Roadmap.jsx — your 12-week plan as a timeline.
// The amber line fills up to the week you're in; each week
// slides in as you scroll to it (whileInView).
// =============================================================
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckIcon, CompassIcon } from "@phosphor-icons/react";
import { api } from "../api.js";
import { Page, Card, Reveal, PageSkeleton, softSpring } from "../components.jsx";

export default function Roadmap() {
  const [profile, setProfile] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    api("/profile").then(setProfile);
    api("/dashboard").then((d) => setCurrentWeek(d.milestone?.week_number ?? 1));
  }, []);

  if (!profile) return <PageSkeleton />;
  const a = profile.assessment;
  const weeks = profile.roadmap;
  const progress = weeks.length > 1 ? (currentWeek - 1) / (weeks.length - 1) : 0;

  return (
    <Page>
      <Reveal className="page-head">
        <span className="label">Your plan</span>
        <h1 className="display">Twelve weeks, <em>one step</em> at a time.</h1>
      </Reveal>

      <Card className="glow">
        <div className="card-head">
          <span className="card-title"><CompassIcon size={18} weight="bold" /> Where you started</span>
          <span className="tag">{a.level}</span>
        </div>
        <p>{a.summary}</p>
        <p className="faint" style={{ marginTop: 10, fontSize: "0.88rem" }}>
          Baseline quiz <span className="num">{profile.quiz_score ?? "–"}/100</span> · now in week <span className="num">{currentWeek}</span>
        </p>
      </Card>

      <ol className="timeline">
        <motion.span
          className="timeline-progress"
          style={{ height: "calc(100% - 20px)" }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: progress }}
          transition={{ ...softSpring, delay: 0.3 }}
          aria-hidden
        />
        {weeks.map((w) => {
          const state = w.week_number < currentWeek ? "past" : w.week_number === currentWeek ? "current" : "future";
          return (
            <motion.li
              key={w.id}
              className={`week ${state}`}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={softSpring}
              aria-current={state === "current" ? "step" : undefined}
            >
              <div className="week-node">
                {state === "past" ? <CheckIcon size={14} weight="bold" /> : String(w.week_number).padStart(2, "0")}
              </div>
              <div className={`card week-card ${state === "current" ? "glow" : ""}`}>
                <span className="label">
                  Week {w.week_number}{state === "current" ? " · you are here" : ""}
                </span>
                <h3 style={{ marginTop: 4 }}>{w.title}</h3>
                <p className="muted" style={{ fontSize: "0.92rem", marginTop: 2 }}>{w.focus}</p>
                {state !== "past" && (
                  <ul>{w.goals.map((g) => <li key={g}>{g}</li>)}</ul>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Page>
  );
}
