// =============================================================
// CheckIn.jsx — the evening check-in (a FORM).
// Controlled inputs: each input's value lives in React state.
// =============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  SmileySadIcon, SmileyMehIcon, SmileyIcon, SmileyWinkIcon, BatteryLowIcon, BatteryMediumIcon, BatteryFullIcon,
  TrophyIcon, BarricadeIcon, SparkleIcon,
} from "@phosphor-icons/react";
import { api } from "../api.js";
import { Page, Card, Reveal, Ring, Button, PageSkeleton } from "../components.jsx";

// Each level gets an icon + a name (the name lets the icon swap animate)
const moodIcon = (v) =>
  v <= 3 ? [SmileySadIcon, "low"] : v <= 5 ? [SmileyMehIcon, "meh"] : v <= 8 ? [SmileyIcon, "good"] : [SmileyWinkIcon, "great"];
const energyIcon = (v) => (v <= 3 ? [BatteryLowIcon, "low"] : v <= 7 ? [BatteryMediumIcon, "mid"] : [BatteryFullIcon, "full"]);

export default function CheckIn() {
  const [existing, setExisting] = useState(undefined); // undefined = still loading
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({ mood: 6, energy: 6, wins: "", blockers: "" });
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/checkins/today")
      .then((c) => {
        setExisting(c);
        if (c) setForm({ mood: c.mood, energy: c.energy, wins: c.wins ?? "", blockers: c.blockers ?? "" });
      })
      .catch((e) => setError(e.message));
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

  if (existing === undefined && !error) return <PageSkeleton />;

  const done = tasks.filter((t) => t.done).length;
  const shownReply = reply || existing?.coach_reply;

  return (
    <Page>
      <Reveal className="page-head">
        <span className="label">Evening check-in</span>
        <h1 className="display">How did <em>today</em> go?</h1>
      </Reveal>

      <Card className="today-card">
        <Ring value={tasks.length ? done / tasks.length : 0} size={72} stroke={7}>
          <span className="num" style={{ fontSize: "0.95rem" }}>{done}/{tasks.length}</span>
        </Ring>
        <div className="today-copy">
          <strong style={{ fontSize: "1.3rem" }}>
            {tasks.length && done === tasks.length ? "Every task done." : `${done} of ${tasks.length} tasks done`}
          </strong>
          <Link to="/" className="muted" style={{ fontSize: "0.9rem" }}>Update tasks →</Link>
        </div>
      </Card>

      <AnimatePresence mode="popLayout">
        {shownReply && (
          <motion.section
            key={shownReply}
            className="card glow"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="card-head">
              <span className="card-title"><SparkleIcon size={18} weight="fill" /> Coach says</span>
            </div>
            <p style={{ fontSize: "1.02rem" }}>{shownReply}</p>
          </motion.section>
        )}
      </AnimatePresence>

      <Card as="form" className="form" onSubmit={submit}>
        <Slider label="Mood" value={form.mood} onChange={update("mood")} icon={moodIcon(form.mood)} />
        <Slider label="Energy" value={form.energy} onChange={update("energy")} icon={energyIcon(form.energy)} />

        <div className="field">
          <label className="field-label" htmlFor="wins">
            <span><TrophyIcon size={16} weight="duotone" style={{ verticalAlign: "-2px", color: "var(--accent)" }} /> What went well?</span>
          </label>
          <textarea id="wins" className="input" rows={3} value={form.wins} onChange={update("wins")}
            placeholder="Finished 2 problems, finally understood recursion…" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="blockers">
            <span><BarricadeIcon size={16} weight="duotone" style={{ verticalAlign: "-2px", color: "var(--accent)" }} /> What stopped you? Be honest.</span>
          </label>
          <textarea id="blockers" className="input" rows={3} value={form.blockers} onChange={update("blockers")}
            placeholder="Lost an hour on Instagram after dinner…" />
        </div>

        {error && <p className="error">{error}</p>}
        <Button variant="primary" className="wide lg" disabled={sending}>
          {sending ? "Coach is reading…" : existing || reply ? "Update check-in" : "Submit check-in"}
        </Button>
      </Card>
    </Page>
  );
}

function Slider({ label, value, onChange, icon: [Icon, level] }) {
  const id = `range-${label.toLowerCase()}`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        <span>{label}</span>
        <span className="field-value">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={level} initial={{ scale: 0.5, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }} style={{ display: "inline-flex" }}>
              <Icon size={22} weight="duotone" />
            </motion.span>
          </AnimatePresence>
          {value}/10
        </span>
      </label>
      <input id={id} className="range" type="range" min="1" max="10" value={value} onChange={onChange} style={{ "--val": value }} />
    </div>
  );
}
