// =============================================================
// components.jsx — reusable, ANIMATED building blocks
// -------------------------------------------------------------
// Animations use the "motion" library (formerly Framer Motion).
// Key ideas:
//   - SPRINGS instead of fixed durations: things move like real
//     objects (they accelerate, overshoot a tiny bit, settle).
//   - VARIANTS: name animation states ("hidden" / "show") once, and
//     children inherit them, so a page can STAGGER its cards in.
//   - Only transform + opacity are animated, which the GPU handles
//     smoothly even on cheap phones.
// Users with "reduce motion" switched on get no movement: see
// <MotionConfig reducedMotion="user"> in App.jsx.
// =============================================================
import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import confetti from "canvas-confetti";

// ---- Motion presets ----------------------------------------------------------
export const spring = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 };
export const softSpring = { type: "spring", stiffness: 160, damping: 24 };

// A page fades/slides in, then its children cascade in one by one
export const pageVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { ...softSpring, staggerChildren: 0.06, delayChildren: 0.04 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};
export const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
};

// Wrap every page in this: <Page>…</Page>
export function Page({ children, wide = false, className = "" }) {
  return (
    <motion.main
      id="main"
      className={`page ${wide ? "wide" : ""} ${className}`}
      variants={pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {children}
    </motion.main>
  );
}

// Any direct child of <Page> that should cascade in
export function Reveal({ as = "div", children, ...props }) {
  const Tag = motion[as];
  return (
    <Tag variants={itemVariants} {...props}>
      {children}
    </Tag>
  );
}

// ---- Card with a spotlight that follows the cursor -----------------------
export function Card({ as = "section", className = "", children, ...props }) {
  const Tag = motion[as];
  const onPointerMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Tag variants={itemVariants} className={`card spot ${className}`} onPointerMove={onPointerMove} {...props}>
      {children}
    </Tag>
  );
}

// ---- Button with a physical "press" -------------------------------------
export function Button({ variant = "", className = "", children, ...props }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97, y: 0 }}
      transition={spring}
      className={`btn ${variant} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// ---- Numbers that count up (and glide when the value changes) ------------
export function AnimatedNumber({ value, decimals = 0 }) {
  const mv = useSpring(0, { stiffness: 90, damping: 22 });
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    mv.set(Number(value) || 0);
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

// ---- Progress ring --------------------------------------------------------
export function Ring({ value, size = 92, stroke = 9, children }) {
  const r = (size - stroke) / 2;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <motion.circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.001, Math.min(1, value)) }}
          transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.2 }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

// ---- Checkbox whose tick draws itself ------------------------------------
export function Check({ checked, onChange, label }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`check ${checked ? "on" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      whileTap={{ scale: 0.85 }}
      transition={spring}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <motion.path
          d="M2.5 7.5 L5.6 10.4 L11.5 3.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        />
      </svg>
    </motion.button>
  );
}

// ---- Stat tile ------------------------------------------------------------
export function StatTile({ icon: Icon, label, value, suffix, decimals = 0 }) {
  return (
    <motion.div className="stat" variants={itemVariants}>
      <div className="stat-top">
        <span className="label">{label}</span>
        {Icon && <Icon size={18} weight="duotone" />}
      </div>
      <div className="stat-value">
        {value == null ? "—" : <AnimatedNumber value={value} decimals={decimals} />}
        {value != null && suffix && <small>{suffix}</small>}
      </div>
    </motion.div>
  );
}

// ---- Score meters (grow from the left, one after another) ----------------
export function ScoreBars({ scores }) {
  return (
    <div className="scores">
      {scores.map((s, i) => (
        <div className="score" key={s.name}>
          <div className="score-head">
            <span>{s.name}</span>
            <b>
              <AnimatedNumber value={s.value} />
            </b>
          </div>
          <div className="meter" role="meter" aria-valuenow={s.value} aria-valuemin={0} aria-valuemax={100} aria-label={s.name}>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: s.value / 100 }}
              transition={{ ...softSpring, delay: 0.15 + i * 0.07 }}
            />
          </div>
          <p className="score-reason">{s.reason}</p>
        </div>
      ))}
    </div>
  );
}

// ---- 14-day bar chart (bars grow in a wave; hover/tap for details) -------
export function CompletionChart({ stats }) {
  const [active, setActive] = useState(null);
  const shown = active ?? stats[stats.length - 1];
  const pct = (d) => (d.total ? Math.round((d.done / d.total) * 100) : 0);
  const label = (date) => new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

  return (
    <div>
      <p className="chart-readout">
        <b>{label(shown.date)}</b> · {shown.total ? `${shown.done} of ${shown.total} tasks (${pct(shown)}%)` : "no tasks"}
        {shown.mood ? ` · mood ${shown.mood}/10` : ""}
      </p>
      <div
        className="bars"
        onMouseLeave={() => setActive(null)}
        role="img"
        aria-label={stats.map((d) => `${d.date}: ${d.done} of ${d.total} tasks`).join("; ")}
      >
        {stats.map((d, i) => (
          <button
            key={d.date}
            className={`bar-slot ${active?.date === d.date ? "active" : ""}`}
            onMouseEnter={() => setActive(d)}
            onFocus={() => setActive(d)}
            onClick={() => setActive(d)}
            aria-label={`${label(d.date)}: ${d.done} of ${d.total} tasks done`}
          >
            <motion.span
              className={`bar ${d.total ? "" : "empty"}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: d.total ? Math.max(pct(d), 4) / 100 : 0.03 }}
              transition={{ ...softSpring, delay: i * 0.03 }}
            />
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

// ---- Loading skeletons (shaped like the content that's coming) ----------
export function Skeleton({ height = 120, className = "" }) {
  return <div className={`skeleton ${className}`} style={{ height }} aria-hidden />;
}
export function PageSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading">
      <Skeleton height={140} />
      <div className="stat-grid">
        <Skeleton height={86} />
        <Skeleton height={86} />
        <Skeleton height={86} />
      </div>
      <Skeleton height={220} />
    </main>
  );
}

// ---- Empty state ------------------------------------------------------------
export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{Icon && <Icon size={26} weight="duotone" />}</div>
      <h3>{title}</h3>
      <p className="muted" style={{ maxWidth: "38ch" }}>{children}</p>
    </div>
  );
}

// ---- Celebration ------------------------------------------------------------
export function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#0a4174", "#49769f", "#7bbde8", "#bdd8e9", "#4e8ea2"];
  const fire = (ratio, opts) =>
    confetti({ particleCount: Math.floor(160 * ratio), origin: { y: 0.75 }, colors, disableForReducedMotion: true, ...opts });
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
}

// ---- Tiny, safe Markdown for chat replies (**bold**, lists, paragraphs) --
// No dangerouslySetInnerHTML: we build React elements, so AI text can
// never inject HTML/scripts into the page.
export function RichText({ text }) {
  const blocks = String(text).split(/\n{2,}/);
  const inline = (line, key) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong> : part,
    );
  return blocks.map((block, b) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*([-•*]|\d+\.)\s+/.test(l))) {
      return (
        <ul key={b}>
          {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*([-•*]|\d+\.)\s+/, ""), `${b}-${i}`)}</li>)}
        </ul>
      );
    }
    return <p key={b}>{lines.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l, `${b}-${i}`)}</span>)}</p>;
  });
}

// ---- Segmented tabs with a sliding pill ----------------------------------
// options: [{ value, label, badge? }]. `id` keeps pills of different
// controls from sliding into each other.
export function Segmented({ id, value, onChange, options, className = "" }) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={spring} />}
          <span>{o.label}</span>
          {o.badge > 0 && <span className="badge">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- Round avatar with the first letter of a name -----------------------
// The colour comes from the name, so each person always gets the same one.
const AVATAR_COLORS = ["#0a4174", "#49769f", "#4e8ea2", "#1f6f8b", "#2c5d8a", "#5b7fa6"];
export function Avatar({ name = "?", size = 44 }) {
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  return (
    <span className="avatar-circle" aria-hidden style={{ width: size, height: size, fontSize: size * 0.42, background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}>
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

// ---- A multiple-choice quiz (used by the duel + weekly quiz) -------------
// questions: [{ question, options }] -> onSubmit([chosen index or null, …])
export function QuizRunner({ questions, onSubmit, submitLabel = "Submit" }) {
  const [chosen, setChosen] = useState({});
  const [busy, setBusy] = useState(false);
  const answered = Object.keys(chosen).length;
  async function submit() {
    setBusy(true);
    try {
      await onSubmit(questions.map((_, i) => chosen[i] ?? null));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="quiz-run">
      {questions.map((q, i) => (
        <Card key={i} className="quiz-card">
          <p className="quiz-q"><span className="num faint">{String(i + 1).padStart(2, "0")}</span>&nbsp; {q.question}</p>
          <div className="options">
            {q.options.map((opt, j) => (
              <motion.button key={j} className={`option ${chosen[i] === j ? "selected" : ""}`} onClick={() => setChosen({ ...chosen, [i]: j })} whileTap={{ scale: 0.98 }}>
                <kbd>{String.fromCharCode(65 + j)}</kbd>
                {opt}
              </motion.button>
            ))}
          </div>
        </Card>
      ))}
      <div className="quiz-submit">
        <span className="muted">{answered}/{questions.length} answered</span>
        <Button variant="primary" className="lg" onClick={submit} disabled={busy || answered === 0}>
          {busy ? "Checking…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}

// After submitting: every question with the right answer and yours
export function QuizReview({ questions }) {
  return (
    <div className="quiz-run">
      {questions.map((q, i) => {
        const right = q.chosen === q.correct_index;
        return (
          <Card key={i} className="quiz-card">
            <p className="quiz-q">
              <span className={`tag ${right ? "good" : "bad"}`}>{right ? "✓" : q.chosen == null ? "–" : "✗"}</span>&nbsp; {q.question}
            </p>
            <div className="options">
              {q.options.map((opt, j) => (
                <div key={j} className={`option static ${j === q.correct_index ? "correct" : ""} ${j === q.chosen && !right ? "wrong" : ""}`}>
                  <kbd>{String.fromCharCode(65 + j)}</kbd>
                  {opt}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
