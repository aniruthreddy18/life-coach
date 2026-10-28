// =============================================================
// Onboarding.jsx — first-time setup, in phases:
//   intro -> questions -> quiz (level test) -> analyzing -> results
// All answers live in React state until we send them to the server.
// Questions slide left/right depending on the direction you move.
// =============================================================
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, ArrowLeftIcon, BarbellIcon, WarningIcon, MapTrifoldIcon, SparkleIcon, CheckIcon } from "@phosphor-icons/react";
import { api } from "../api.js";
import { ScoreBars, Button, Skeleton, spring, softSpring } from "../components.jsx";

const slide = {
  enter: (dir) => ({ opacity: 0, x: dir * 60, filter: "blur(4px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)", transition: softSpring },
  exit: (dir) => ({ opacity: 0, x: dir * -60, filter: "blur(4px)", transition: { duration: 0.18 } }),
};
const stagger = { show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } };
const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: softSpring } };

export default function Onboarding({ onDone }) {
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState({ problems: [], mood: 5 });
  const [phase, setPhase] = useState("intro");
  const [quiz, setQuiz] = useState([]);
  const [chosen, setChosen] = useState({}); // quiz question index -> option index
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // 1. Load the questions from the backend
  useEffect(() => {
    api("/onboarding/questions").then(setQuestions).catch((e) => setError(e.message));
  }, []);

  const q = questions[step];
  const value = q ? answers[q.id] : undefined;
  const canContinue = q && (q.type === "multi" || (value !== undefined && String(value).trim() !== ""));
  const setAnswer = (v) => setAnswers((a) => ({ ...a, [q.id]: v }));

  function go(to) {
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  async function next() {
    if (!canContinue) return;
    if (step < questions.length - 1) return go(step + 1);
    // Last question answered -> get a level test
    setPhase("loadingQuiz");
    setError("");
    try {
      const data = await api("/onboarding/quiz", { method: "POST", body: { answers } });
      setQuiz(data.questions);
      setPhase("quiz");
    } catch (e) {
      setError(e.message);
      setPhase("questions");
    }
  }

  async function finish() {
    setPhase("analyzing");
    setError("");
    const graded = quiz.map((item, i) => ({ ...item, chosen_index: chosen[i] ?? -1 }));
    try {
      const data = await api("/onboarding/complete", { method: "POST", body: { answers, quiz: graded } });
      setResult(data);
      setPhase("results");
    } catch (e) {
      setError(e.message);
      setPhase("quiz");
    }
  }

  // Keyboard: 1-9 picks an option, Enter continues
  useEffect(() => {
    if (phase !== "questions" || !q) return;
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (e.key === "Enter" && !e.shiftKey && (!typing || q.type === "text")) {
        e.preventDefault();
        next();
      }
      const n = Number(e.key);
      if (!typing && n >= 1 && q.options && n <= q.options.length) {
        const opt = q.options[n - 1];
        if (q.type === "choice") setAnswer(opt);
        if (q.type === "multi") {
          const list = answers[q.id] ?? [];
          setAnswer(list.includes(opt) ? list.filter((x) => x !== opt) : [...list, opt]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main id="main" className="onboard">
      <div className="onboard-top">
        <span className="brand-name">Life Coach</span>
        {phase === "questions" && questions.length > 0 && (
          <div className="segments" aria-label={`Question ${step + 1} of ${questions.length}`}>
            {questions.map((_, i) => (
              <span key={i}>
                <motion.i initial={false} animate={{ scaleX: i <= step ? 1 : 0 }} transition={spring} />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="onboard-stage">
        <AnimatePresence mode="wait" custom={dir}>
          {phase === "intro" && <Intro key="intro" ready={questions.length > 0} error={error} onStart={() => setPhase("questions")} />}

          {phase === "questions" && q && (
            <motion.div key={`q-${step}`} className="question" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
              <span className="label">Question {step + 1} of {questions.length}</span>
              <h1>{q.text}</h1>
              <QuestionInput q={q} value={value} onChange={setAnswer} />
              {error && <p className="error">{error}</p>}
              <div className="onboard-nav">
                <Button variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
                  <ArrowLeftIcon size={16} /> Back
                </Button>
                <span className="hint">press <kbd>Enter</kbd></span>
                <Button variant="primary" disabled={!canContinue} onClick={next}>
                  {step === questions.length - 1 ? "Finish" : "Next"} <ArrowRightIcon size={16} weight="bold" />
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "loadingQuiz" && <Thinking key="lq" lines={["Picking questions for your subject…", "Balancing easy and hard…"]} />}

          {phase === "quiz" && (
            <motion.div key="quiz" className="question" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={stagger}>
              <motion.div variants={rise}>
                <span className="label">Quick level check</span>
                <h1 style={{ marginTop: 8 }}>Five questions. Skip the ones you don't know.</h1>
              </motion.div>
              {quiz.map((item, i) => (
                <motion.section key={i} className="card quiz-card" variants={rise}>
                  <p className="quiz-q"><span className="num faint">0{i + 1}</span>&nbsp; {item.question}</p>
                  <div className="options">
                    {item.options.map((opt, j) => (
                      <motion.button
                        key={j}
                        className={`option ${chosen[i] === j ? "selected" : ""}`}
                        onClick={() => setChosen({ ...chosen, [i]: j })}
                        whileTap={{ scale: 0.98 }}
                      >
                        <kbd>{String.fromCharCode(65 + j)}</kbd>
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                </motion.section>
              ))}
              {error && <p className="error">{error}</p>}
              <motion.div variants={rise}>
                <Button variant="primary" className="wide lg" onClick={finish}>
                  Analyze me <SparkleIcon size={18} weight="fill" />
                </Button>
              </motion.div>
            </motion.div>
          )}

          {phase === "analyzing" && (
            <Thinking
              key="an"
              lines={["Reading your answers…", "Checking your level…", "Finding your strengths…", "Drafting your 12 weeks…", "Almost there…"]}
            />
          )}

          {phase === "results" && result && <Results key="res" result={result} onDone={onDone} />}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Intro({ ready, error, onStart }) {
  return (
    <motion.div className="question" initial="hidden" animate="show" exit={{ opacity: 0, y: -12 }} variants={stagger}>
      <motion.span className="label" variants={rise}>Welcome</motion.span>
      <motion.h1 variants={rise} style={{ fontSize: "clamp(2rem, 7.5vw, 3rem)" }}>
        Let's find out where you are, and <em style={{ color: "var(--accent-ink)" }}>where you're going.</em>
      </motion.h1>
      <motion.p className="muted" variants={rise} style={{ fontSize: "1.05rem", maxWidth: "46ch" }}>
        12 quick questions and a short level test. Then your coach builds a 12-week plan and checks in with you every day.
      </motion.p>
      <motion.div variants={rise}>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <Button variant="primary" className="lg" onClick={onStart} disabled={!ready}>
            {ready ? "Start" : "Loading…"} <ArrowRightIcon size={18} weight="bold" />
          </Button>
        )}
      </motion.div>
      <motion.p className="faint" variants={rise} style={{ fontSize: "0.85rem" }}>Takes about 4 minutes.</motion.p>
    </motion.div>
  );
}

// Orbiting rings + rotating status lines while the server works
function Thinking({ lines }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 1800);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ textAlign: "center" }} role="status">
      <div className="orbit" aria-hidden>
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
          <i />
        </motion.span>
        <motion.span animate={{ rotate: -360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
        <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={i} className="display" style={{ fontSize: "1.3rem" }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {lines[i]}
        </motion.p>
      </AnimatePresence>
      <div style={{ maxWidth: 320, margin: "26px auto 0", display: "grid", gap: 8 }}>
        <Skeleton height={10} />
        <Skeleton height={10} />
      </div>
    </motion.div>
  );
}

function Results({ result, onDone }) {
  const a = result.assessment;
  return (
    <motion.div className="question" initial="hidden" animate="show" variants={stagger}>
      <motion.div variants={rise}>
        <span className="label">Your starting point</span>
        <h1 style={{ marginTop: 8 }}>
          {a.level}. Quiz <span className="num" style={{ fontSize: "0.8em" }}>{result.quizScore}/100</span>
        </h1>
      </motion.div>

      <motion.section className="card glow" variants={rise}>
        <p style={{ fontSize: "1.05rem" }}>{a.first_message}</p>
      </motion.section>

      <motion.section className="card" variants={rise}>
        <span className="label">Where you stand</span>
        <p style={{ marginTop: 6 }}>{a.summary}</p>
      </motion.section>

      <motion.section className="card" variants={rise}>
        <span className="label">Your scores</span>
        <div style={{ marginTop: 14 }}><ScoreBars scores={a.scores} /></div>
      </motion.section>

      <motion.div className="report-cols" variants={rise} style={{ marginTop: 0 }}>
        <section className="card">
          <h4><BarbellIcon size={16} weight="duotone" color="var(--good)" /> Strengths</h4>
          <ul>{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
        <section className="card">
          <h4><WarningIcon size={16} weight="duotone" color="var(--bad)" /> To fix</h4>
          <ul>{a.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
      </motion.div>

      <motion.section className="card" variants={rise}>
        <div className="card-head">
          <span className="card-title"><MapTrifoldIcon size={18} weight="bold" /> Your 12-week roadmap</span>
          {result.sources?.roadmap === "library" && <span className="tag good">reused · free</span>}
          {result.sources?.roadmap === "rules" && <span className="tag neutral">template</span>}
        </div>
        <ol style={{ paddingLeft: "1.4em" }}>
          {a.roadmap.map((w) => (
            <li key={w.week_number}><span className="muted">Week {w.week_number}</span> · {w.title}</li>
          ))}
        </ol>
      </motion.section>

      <motion.div variants={rise}>
        <Button variant="primary" className="wide lg" onClick={onDone}>
          Let's start <ArrowRightIcon size={18} weight="bold" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

// One component that draws the right input for each question type
function QuestionInput({ q, value, onChange }) {
  if (q.type === "text" || q.type === "textarea") {
    const Tag = q.type === "text" ? "input" : "textarea";
    return (
      <Tag
        autoFocus
        className="input"
        rows={q.type === "textarea" ? 4 : undefined}
        placeholder={q.placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={q.text}
        style={{ fontSize: "1.1rem" }}
      />
    );
  }
  if (q.type === "choice" || q.type === "multi") {
    const isMulti = q.type === "multi";
    const list = isMulti ? value ?? [] : [];
    const isOn = (opt) => (isMulti ? list.includes(opt) : value === opt);
    const toggle = (opt) => onChange(isMulti ? (isOn(opt) ? list.filter((x) => x !== opt) : [...list, opt]) : opt);
    return (
      <motion.div className="options" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.035 } } }} role={isMulti ? "group" : "radiogroup"} aria-label={q.text}>
        {q.options.map((opt, i) => (
          <motion.button
            key={opt}
            className={`option ${isOn(opt) ? "selected" : ""}`}
            onClick={() => toggle(opt)}
            role={isMulti ? "checkbox" : "radio"}
            aria-checked={isOn(opt)}
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
            whileTap={{ scale: 0.985 }}
          >
            <kbd>{isOn(opt) && isMulti ? <CheckIcon size={12} weight="bold" /> : i + 1}</kbd>
            {q.optionLabels?.[opt] ?? opt}
          </motion.button>
        ))}
        {isMulti && <p className="hint" style={{ marginTop: 4 }}>Pick as many as are true. Press the numbers to toggle.</p>}
      </motion.div>
    );
  }
  if (q.type === "scale") {
    return (
      <div>
        <div className="scale" role="radiogroup" aria-label={q.text}>
          {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => (
            <motion.button
              key={n}
              className={`scale-btn ${value === n ? "selected" : ""}`}
              onClick={() => onChange(n)}
              role="radio"
              aria-checked={value === n}
              whileTap={{ scale: 0.9 }}
              animate={{ y: value === n ? -4 : 0 }}
              transition={spring}
            >
              {n}
            </motion.button>
          ))}
        </div>
        <div className="scale-labels"><span>{q.labels[0]}</span><span>{q.labels[1]}</span></div>
      </div>
    );
  }
  return null;
}
