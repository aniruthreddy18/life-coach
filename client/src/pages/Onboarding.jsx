// =============================================================
// Onboarding.jsx — first-time setup, in 4 phases:
//   questions -> quiz (AI level test) -> analyzing -> results
// All answers live in React state until we send them to the server.
// =============================================================
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { ScoreBars, Spinner } from "../components.jsx";

export default function Onboarding({ onDone }) {
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ problems: [], mood: 5 });
  const [phase, setPhase] = useState("questions");
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
  const canContinue =
    q && (q.type === "multi" || (value !== undefined && String(value).trim() !== ""));

  const setAnswer = (v) => setAnswers({ ...answers, [q.id]: v });

  async function next() {
    if (step < questions.length - 1) return setStep(step + 1);
    // Last question answered -> ask the AI for a level test
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

  // ---------- What to draw for each phase ----------
  if (!questions.length) {
    return <div className="center">{error ? <p className="error">{error}</p> : <Spinner text="Loading…" />}</div>;
  }

  if (phase === "loadingQuiz") return <div className="center"><Spinner text="Preparing a quick level check for you…" /></div>;
  if (phase === "analyzing") return <div className="center"><Spinner text="Your coach is studying your answers and building your 12-week plan… (≈30s)" /></div>;

  if (phase === "quiz") {
    return (
      <div className="onboard">
        <p className="eyebrow">Quick level check</p>
        <h1>5 questions. No pressure — be honest, skip if you don't know.</h1>
        {quiz.map((item, i) => (
          <div className="card" key={i}>
            <p className="quiz-q"><b>{i + 1}.</b> {item.question}</p>
            <div className="options">
              {item.options.map((opt, j) => (
                <button
                  key={j}
                  className={"option" + (chosen[i] === j ? " selected" : "")}
                  onClick={() => setChosen({ ...chosen, [i]: j })}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        <button className="btn primary wide" onClick={finish}>Analyze me →</button>
      </div>
    );
  }

  if (phase === "results") {
    const a = result.assessment;
    return (
      <div className="onboard">
        <p className="eyebrow">Your starting point</p>
        <h1>{a.level} · Quiz {result.quizScore}/100</h1>
        <div className="card coach-bubble">{a.first_message}</div>
        <div className="card">
          <h3>Where you stand</h3>
          <p>{a.summary}</p>
        </div>
        <div className="card">
          <h3>Your scores</h3>
          <ScoreBars scores={a.scores} />
        </div>
        <div className="grid2">
          <div className="card">
            <h3>💪 Strengths</h3>
            <ul>{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <div className="card">
            <h3>🎯 To fix</h3>
            <ul>{a.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>
        <div className="card">
          <h3>Your 12-week roadmap</h3>
          {result.sources?.roadmap === "library" && <p className="muted small-print">Reused from the library: free, instant.</p>}
          {result.sources?.roadmap === "rules" && <p className="muted small-print">Made from a template (AI not available).</p>}
          <ol className="roadmap-mini">
            {a.roadmap.map((w) => <li key={w.week_number}><b>Week {w.week_number}:</b> {w.title}</li>)}
          </ol>
        </div>
        <button className="btn primary wide" onClick={onDone}>Let's start →</button>
      </div>
    );
  }

  // phase === "questions"
  return (
    <div className="onboard">
      <div className="progress"><div style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
      <p className="eyebrow">Question {step + 1} of {questions.length}</p>
      <h1>{q.text}</h1>

      <QuestionInput q={q} value={value} onChange={setAnswer} onEnter={() => canContinue && next()} />

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
        <button className="btn primary" disabled={!canContinue} onClick={next}>
          {step === questions.length - 1 ? "Finish" : "Next →"}
        </button>
      </div>
    </div>
  );
}

// One component that draws the right input for each question type
function QuestionInput({ q, value, onChange, onEnter }) {
  if (q.type === "text") {
    return (
      <input
        autoFocus
        className="input"
        placeholder={q.placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
      />
    );
  }
  if (q.type === "textarea") {
    return (
      <textarea
        autoFocus
        className="input"
        rows={4}
        placeholder={q.placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (q.type === "choice") {
    return (
      <div className="options">
        {q.options.map((opt) => (
          <button key={opt} className={"option" + (value === opt ? " selected" : "")} onClick={() => onChange(opt)}>
            {q.optionLabels?.[opt] ?? opt}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "multi") {
    const list = value ?? [];
    const toggle = (opt) => onChange(list.includes(opt) ? list.filter((x) => x !== opt) : [...list, opt]);
    return (
      <div className="chips">
        {q.options.map((opt) => (
          <button key={opt} className={"chip" + (list.includes(opt) ? " selected" : "")} onClick={() => toggle(opt)}>
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "scale") {
    return (
      <div>
        <div className="scale">
          {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => (
            <button key={n} className={"scale-btn" + (value === n ? " selected" : "")} onClick={() => onChange(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="scale-labels"><span>{q.labels[0]}</span><span>{q.labels[1]}</span></div>
      </div>
    );
  }
  return null;
}
