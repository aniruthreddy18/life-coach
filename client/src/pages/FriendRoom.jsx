// =============================================================
// FriendRoom.jsx — you + one study buddy
// -------------------------------------------------------------
//   Duel    -> today's 5-question duel + live scoreboard
//   Chat    -> messages (checks for new ones every 4 seconds) + Poke
//   Weekly  -> this week's 10-question quiz
//   Record  -> wins / losses / ties and recent duels
// The ⋮ menu has Unfriend, Block and Report.
// =============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeftIcon, DotsThreeVerticalIcon, PaperPlaneRightIcon, HandPointingIcon, TrophyIcon, CrownIcon,
  UserMinusIcon, ProhibitIcon, FlagIcon, SwordIcon, NotebookIcon,
} from "@phosphor-icons/react";
import { api } from "../api.js";
import {
  Page, Reveal, Card, Button, Segmented, Avatar, Skeleton, QuizRunner, QuizReview, AnimatedNumber, celebrate, spring,
} from "../components.jsx";

// Named states (not plain objects), so the cards inside cascade in with them
const tabVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function FriendRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("duel");
  const [menu, setMenu] = useState(false);

  const load = useCallback(() => api(`/friends/${id}`).then(setInfo).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Page>
        <Link to="/friends" className="back-link"><ArrowLeftIcon size={16} /> Friends</Link>
        <Card><p className="error">{error}</p></Card>
      </Page>
    );
  }
  if (!info) return <Page><Skeleton height={90} /><Skeleton height={300} /></Page>;
  const friend = info.friend;

  return (
    <Page className="room">
      <Reveal className="room-head">
        <Link to="/friends" className="icon-btn" aria-label="Back to friends"><ArrowLeftIcon size={20} /></Link>
        <Avatar name={friend.name} size={46} />
        <div className="friend-main">
          <h1 style={{ fontSize: "1.2rem" }}>{friend.name}</h1>
          <span className="friend-sub">
            {friend.subjects.join(" + ")} · {friend.level}{friend.streak > 0 ? ` · 🔥 ${friend.streak}` : ""}
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <button className="icon-btn" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <DotsThreeVerticalIcon size={22} weight="bold" />
          </button>
          <AnimatePresence>
            {menu && <SafetyMenu info={info} onClose={() => setMenu(false)} onLeft={() => navigate("/friends", { replace: true })} />}
          </AnimatePresence>
        </div>
      </Reveal>

      <Reveal>
        <Segmented
          id="room-tabs"
          className="wide-seg"
          value={tab}
          onChange={setTab}
          options={[
            { value: "duel", label: "⚔️ Duel" },
            { value: "chat", label: "💬 Chat" },
            { value: "weekly", label: "📝 Weekly" },
            { value: "record", label: "🏆 Record" },
          ]}
        />
      </Reveal>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} className="tab-body" variants={tabVariants} initial="hidden" animate="show" exit="exit">
          {tab === "duel" && <DuelTab id={id} friend={friend} onFinished={load} />}
          {tab === "chat" && <ChatTab id={id} friend={friend} />}
          {tab === "weekly" && <WeeklyTab id={id} friend={friend} />}
          {tab === "record" && <RecordTab info={info} />}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

// ---- ⚔️ Daily duel ------------------------------------------------------------
function DuelTab({ id, friend, onFinished }) {
  const [duel, setDuel] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/friends/${id}/duel`).then(setDuel).catch((e) => setError(e.message));
  }, [id]);

  async function submit(answers) {
    try {
      const d = await api(`/friends/${id}/duel`, { method: "POST", body: { answers } });
      setDuel(d);
      if (d.me.quizCorrect >= 4) celebrate();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <Card><p className="error">{error}</p></Card>;
  if (!duel) return <Skeleton height={260} />;
  const played = duel.me.submitted;

  return (
    <div className="stack">
      <Scoreboard duel={duel} friend={friend} />
      {!played && !duel.finalized && (
        <>
          <div className="duel-intro">
            <h3><SwordIcon size={18} weight="bold" /> Today's duel: {duel.topic}</h3>
            <p className="muted">
              Same {duel.questions.length} questions for both of you. {duel.points.perQuestion} points each, plus up to {duel.points.tasks} for
              your tasks and {duel.points.checkin} for the evening check-in. One try only!
            </p>
          </div>
          <QuizRunner questions={duel.questions} onSubmit={submit} submitLabel="Lock my answers ⚔️" />
        </>
      )}
      {(played || duel.finalized) && duel.questions[0]?.correct_index !== undefined && (
        <>
          <span className="label">Your answers</span>
          <QuizReview questions={duel.questions} />
        </>
      )}
      {!duel.finalized && <p className="faint small">Task and check-in points keep counting until tonight. The winner is announced at 11:55 PM.</p>}
    </div>
  );
}

function Scoreboard({ duel, friend }) {
  const { me, them } = duel;
  const banner = duel.finalized
    ? duel.winner === "me" ? "🏆 You won today's duel!" : duel.winner === "them" ? `${friend.name} won today 😅 Revenge tomorrow` : "🤝 It's a tie"
    : !me.submitted ? (them.submitted ? `${friend.name} already played. Your move!` : "Play first and set the score to beat")
    : !them.submitted ? `Waiting for ${friend.name} to play…`
    : duel.leader === "me" ? "You're leading 🔥" : duel.leader === "them" ? `${friend.name} is leading. Finish your tasks!` : "Neck and neck!";
  return (
    <Card className="scoreboard">
      <div className={`score-banner ${duel.winner === "me" || duel.leader === "me" ? "good" : ""}`}>{banner}</div>
      <div className="vs-grid">
        <Side name="You" p={me} winner={duel.winner === "me"} />
        <span className="vs">VS</span>
        <Side name={friend.name} p={them} winner={duel.winner === "them"} />
      </div>
    </Card>
  );
}

function Side({ name, p, winner }) {
  const hidden = p.total === null;
  return (
    <div className="side">
      <div className="side-name">{winner && <CrownIcon size={16} weight="fill" color="#e0a100" />} {name}</div>
      <div className="side-total num">{hidden ? "?" : <AnimatedNumber value={p.total} />}</div>
      <ul className="side-rows">
        <li><span>Quiz</span><span>{hidden ? (p.submitted ? "played ✓" : "–") : `${p.quizCorrect}/5`}</span></li>
        <li><span>Tasks</span><span>{p.tasksDone}/{p.tasksTotal}</span></li>
        <li><span>Check-in</span><span>{p.checkedIn ? "✓" : "–"}</span></li>
      </ul>
    </div>
  );
}

// ---- 💬 Chat ---------------------------------------------------------------------
function ChatTab({ id, friend }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const lastId = useRef(0);
  const bottomRef = useRef(null);

  // Ask for new messages every 4 seconds ("polling")
  useEffect(() => {
    let alive = true;
    const fetchNew = async () => {
      try {
        const fresh = await api(`/friends/${id}/messages?after=${lastId.current}`);
        if (!alive || !fresh.length) return;
        lastId.current = fresh.at(-1).id;
        setMessages((m) => [...m.filter((x) => !fresh.some((f) => f.id === x.id)), ...fresh]);
      } catch {}
    };
    fetchNew();
    const timer = setInterval(fetchNew, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    setNote("");
    try {
      const msg = await api(`/friends/${id}/messages`, { method: "POST", body: { text: body } });
      lastId.current = Math.max(lastId.current, msg.id);
      setMessages((m) => [...m, msg]);
    } catch (err) {
      setNote(err.message);
      setText(body);
    }
  }

  async function poke() {
    setNote("");
    try {
      const msg = await api(`/friends/${id}/poke`, { method: "POST" });
      lastId.current = Math.max(lastId.current, msg.id);
      setMessages((m) => [...m, msg]);
    } catch (err) {
      setNote(err.message);
    }
  }

  return (
    <div className="friend-chat">
      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <h3>Say hi to {friend.name} 👋</h3>
            <p className="muted">Plan a study session, share a problem, or trash-talk before the duel 😄</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) =>
            m.kind === "poke" ? (
              <motion.div key={m.id} className="system-msg" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                {m.mine ? m.content : `👉 ${friend.name} poked you!`}
              </motion.div>
            ) : (
              <motion.div
                key={m.id}
                className={`msg ${m.mine ? "user" : "assistant"}`}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={spring}
                style={{ transformOrigin: m.mine ? "bottom right" : "bottom left" }}
              >
                {m.content}
              </motion.div>
            ),
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
      {note && <p className="error small">{note}</p>}
      <form className="composer" onSubmit={send}>
        <button type="button" className="btn ghost send-btn" onClick={poke} aria-label={`Poke ${friend.name}`} title="Poke">
          <HandPointingIcon size={20} weight="fill" />
        </button>
        <label htmlFor="friend-input" className="sr-only">Message {friend.name}</label>
        <input id="friend-input" className="input" placeholder={`Message ${friend.name}…`} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} autoComplete="off" />
        <motion.button className="btn primary send-btn" disabled={!text.trim()} aria-label="Send" whileTap={{ scale: 0.9 }}>
          <PaperPlaneRightIcon size={18} weight="fill" />
        </motion.button>
      </form>
    </div>
  );
}

// ---- 📝 Weekly quiz ----------------------------------------------------------------
function WeeklyTab({ id, friend }) {
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/friends/${id}/weekly`).then(setQuiz).catch((e) => setError(e.message));
  }, [id]);

  async function submit(answers) {
    try {
      const q = await api(`/friends/${id}/weekly`, { method: "POST", body: { answers } });
      setQuiz(q);
      if (q.result === "me") celebrate();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <Card><p className="error">{error}</p></Card>;
  if (!quiz) return <Skeleton height={260} />;
  return (
    <div className="stack">
      <Card className="scoreboard">
        <div className="duel-intro">
          <h3><NotebookIcon size={18} weight="bold" /> Weekly quiz: {quiz.topic}</h3>
          <p className="muted">{quiz.total} questions · {fmtDate(quiz.weekStart)} – {fmtDate(quiz.endsOn)} · same for both of you</p>
        </div>
        {quiz.me.submitted && (
          <>
            <div className={`score-banner ${quiz.result === "me" ? "good" : ""}`}>
              {quiz.result === "me" ? "🏆 You beat " + friend.name + "!" : quiz.result === "them" ? `${friend.name} wins this week 😅` : quiz.result === "tie" ? "🤝 Tie!" : `Waiting for ${friend.name}…`}
            </div>
            <div className="vs-grid">
              <div className="side"><div className="side-name">You</div><div className="side-total num">{quiz.me.correct}<small>/{quiz.total}</small></div></div>
              <span className="vs">VS</span>
              <div className="side"><div className="side-name">{friend.name}</div><div className="side-total num">{quiz.them.submitted ? <>{quiz.them.correct}<small>/{quiz.total}</small></> : "…"}</div></div>
            </div>
          </>
        )}
        {!quiz.me.submitted && quiz.them.submitted && <div className="score-banner">{friend.name} already took it. Your turn!</div>}
      </Card>
      {quiz.me.submitted ? <QuizReview questions={quiz.questions} /> : <QuizRunner questions={quiz.questions} onSubmit={submit} submitLabel="Submit weekly quiz" />}
    </div>
  );
}

// ---- 🏆 Record -----------------------------------------------------------------------
function RecordTab({ info }) {
  const r = info.rivalry;
  const streakText = r.streak && r.streak.count > 1
    ? { W: `🔥 You've won ${r.streak.count} in a row`, L: `😬 ${info.friend.name} has won ${r.streak.count} in a row`, T: `${r.streak.count} ties in a row` }[r.streak.result]
    : null;
  return (
    <div className="stack">
      <Card>
        <div className="card-head"><span className="card-title"><TrophyIcon size={18} weight="bold" /> Head to head</span></div>
        <div className="record-grid">
          <div><span className="num big">{r.wins}</span><span className="label">wins</span></div>
          <div><span className="num big">{r.losses}</span><span className="label">losses</span></div>
          <div><span className="num big">{r.ties}</span><span className="label">ties</span></div>
        </div>
        {streakText && <p style={{ marginTop: 12, fontWeight: 600 }}>{streakText}</p>}
      </Card>
      <Card>
        <div className="card-head"><span className="card-title">Recent duels</span></div>
        {r.history.length === 0 ? (
          <p className="muted">No finished duels yet. Today's result comes tonight ⚔️</p>
        ) : (
          <ul className="history">
            {r.history.map((h) => (
              <li key={h.date}>
                <span className={`tag ${h.result === "W" ? "good" : h.result === "L" ? "bad" : "neutral"}`}>{h.result}</span>
                <span className="faint">{fmtDate(h.date)}</span>
                <span className="history-topic">{h.topic}</span>
                <span className="num">{h.me}–{h.them}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <div className="card-head"><span className="card-title">Why you matched</span><span className="tag">{info.match.score}%</span></div>
        <div className="chips-sm">{info.match.reasons.map((x) => <span key={x} className="tag neutral">{x}</span>)}</div>
        {info.friend.goal && <p className="match-goal" style={{ marginTop: 10 }}>{info.friend.name}'s goal: “{info.friend.goal}”</p>}
      </Card>
    </div>
  );
}

// ---- ⋮ Unfriend / Block / Report ------------------------------------------------------
function SafetyMenu({ info, onClose, onLeft }) {
  const [mode, setMode] = useState(null); // null | "report" | "sent"
  const [reason, setReason] = useState("");
  const name = info.friend.name;

  async function unfriend() {
    if (!confirm(`Remove ${name} from your study buddies?`)) return;
    await api(`/friends/${info.friendshipId}`, { method: "DELETE" });
    onLeft();
  }
  async function block() {
    if (!confirm(`Block ${name}? You won't see each other anywhere and your chat ends.`)) return;
    await api("/friends/block", { method: "POST", body: { userId: info.friend.id } });
    onLeft();
  }
  async function report(e) {
    e.preventDefault();
    await api("/friends/report", { method: "POST", body: { userId: info.friend.id, reason } });
    setMode("sent");
  }

  return (
    <motion.div className="menu card" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={spring}>
      {mode === null && (
        <>
          <button onClick={unfriend}><UserMinusIcon size={18} /> Unfriend</button>
          <button onClick={() => setMode("report")}><FlagIcon size={18} /> Report</button>
          <button className="danger" onClick={block}><ProhibitIcon size={18} /> Block</button>
          <button className="faint" onClick={onClose}>Close</button>
        </>
      )}
      {mode === "report" && (
        <form onSubmit={report} className="stack" style={{ padding: 8 }}>
          <label htmlFor="report-reason" className="label">What happened?</label>
          <textarea id="report-reason" className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          <Button variant="primary" type="submit" disabled={!reason.trim()}>Send report</Button>
        </form>
      )}
      {mode === "sent" && (
        <div style={{ padding: 10 }}>
          <p>Thanks. We've noted it. You can also block {name}.</p>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      )}
    </motion.div>
  );
}
