// =============================================================
// duels.js — DAILY DUEL ⚔️ + WEEKLY QUIZ between two friends
// -------------------------------------------------------------
// DAILY DUEL (one per pair per day, max 100 points each):
//   quiz      5 questions, the SAME for both  -> 10 points each (50)
//   tasks     % of YOUR tasks done today      -> up to 30
//   check-in  did the evening check-in        -> 20
// The questions are created the first time either friend opens the
// duel today. Answers are only sent to your browser AFTER you submit,
// so nobody can peek. At night (scheduler.js) each duel is FINALIZED:
// the points are frozen and the winner gets a funny notification.
// Tie on points -> whoever finished the quiz first wins.
//
// WEEKLY QUIZ: 10 questions per pair per week (Monday–Sunday).
//
// Where questions come from (cost-smart, like the rest of the app):
//   1. the shared question bank (free), skipping ones this pair already saw
//   2. running low? the AI writes a fresh batch ONCE and it's saved
//      in the bank for every student with that subject
//   3. AI off/unavailable? repeat older questions, then aptitude ones
// =============================================================
import { all, get, run, today } from "./db.js";
import { getProfile, getTasks } from "./state.js";
import { askJSON, AIUnavailable } from "./ai.js";
import * as library from "./library.js";
import { getFriendship, topicsOf, topicName, subjectsOf, fail } from "./friends.js";
import { notifyUser } from "./push.js";
import { duelResultNote } from "./messages.js";

export const POINTS = { perQuestion: 10, tasks: 30, checkin: 20 };
const DUEL_SIZE = 5;
const WEEKLY_SIZE = 10;

// Subjects both friends study; if none in common, everything either studies
// A readable name for the duel: "DSA + Java", or the student's own words for other subjects
const topicLabel = (topics, me) => (topics.some((t) => t.startsWith("custom:")) ? subjectsOf(me).join(" + ") : topics.map(topicName).join(" + "));

function sharedTopics(a, b) {
  const ta = topicsOf(a), tb = topicsOf(b);
  const shared = ta.filter((t) => tb.includes(t));
  return shared.length ? shared : [...new Set([...ta, ...tb])];
}

// The AI writes `count` new questions for a subject and saves them in the bank
async function generateQuestions(uid, topicKey, count) {
  const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
  const { questions } = await askJSON({
    uid,
    feature: "duel-questions",
    tier: "smart", // the answer key must be right
    system: "You write short, unambiguous multiple-choice questions for students. Double-check that correct_index points to the truly correct option.",
    prompt: `Write ${count} multiple-choice questions on "${topicName(topicKey)}" for students preparing for exams and placements.
Order them from easy to hard (first 40% easy, next 40% medium, rest hard). 4 options each, correct_index 0-3.
Each must be answerable in under a minute.`,
    schema: obj({
      questions: { type: "array", items: obj({ question: { type: "string" }, options: { type: "array", items: { type: "string" } }, correct_index: { type: "integer" } }) },
    }),
  });
  await library.saveQuestions(topicKey, questions.filter((q) => q.options?.length === 4 && q.correct_index >= 0 && q.correct_index < 4));
}

async function pickFor(uid, topics, count, exclude) {
  let qs = await library.pickQuestions(topics, count, exclude);
  if (qs.length < count) {
    try {
      await generateQuestions(uid, topics[0], Math.max(count, 10));
      qs = await library.pickQuestions(topics, count, exclude);
    } catch (err) {
      if (!(err instanceof AIUnavailable)) throw err;
    }
  }
  const have = () => qs.map((q) => q.question);
  if (qs.length < count) qs.push(...(await library.pickQuestions(topics, count - qs.length, have()))); // allow repeats
  if (qs.length < count) qs.push(...(await library.pickQuestions(["aptitude"], count - qs.length, have())));
  return qs;
}

async function bothProfiles(uid, f) {
  const [me, them] = await Promise.all([getProfile(uid), getProfile(f.friendId)]);
  if (!me || !them) throw fail(409, "Your friend is redoing their setup. Try again later.");
  return [me, them];
}

// Check answers against the key. Answers = option index per question (or null = skipped).
function grade(questions, answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw fail(400, `Send ${questions.length} answers.`);
  const clean = answers.map((a) => (Number.isInteger(a) && a >= 0 && a <= 3 ? a : null));
  return { clean, correct: questions.filter((q, i) => clean[i] === q.correct_index).length };
}

// Only show the right answers once you've submitted (or it's over)
const questionsView = (questions, myAnswers, reveal) =>
  questions.map((q, i) => ({
    question: q.question,
    options: q.options,
    topic: q.topic,
    ...(reveal ? { correct_index: q.correct_index, chosen: myAnswers?.[i] ?? null } : {}),
  }));

// =============================================================
// DAILY DUEL
// =============================================================
async function getOrCreateDuel(uid, f, date) {
  const existing = await get("SELECT * FROM duels WHERE friendship_id = $1 AND date = $2", f.id, date);
  if (existing) return existing;
  const [me, them] = await bothProfiles(uid, f);
  const topics = sharedTopics(me, them);
  // Questions this pair saw in the last 60 days
  const seen = (
    await all(
      `SELECT q->>'question' AS question FROM duels d, jsonb_array_elements(d.questions) q
        WHERE d.friendship_id = $1 AND d.date > $2`,
      f.id, today(-60),
    )
  ).map((r) => r.question);
  const questions = await pickFor(uid, topics, DUEL_SIZE, seen);
  // Both friends might open it at the same moment: the UNIQUE (friendship_id, date)
  // rule keeps only one, and the other request just reads it.
  const created = await get(
    `INSERT INTO duels (friendship_id, date, topic, questions) VALUES ($1, $2, $3, $4)
     ON CONFLICT (friendship_id, date) DO NOTHING RETURNING *`,
    f.id, date, topicLabel(topics, me), JSON.stringify(questions),
  );
  return created ?? get("SELECT * FROM duels WHERE friendship_id = $1 AND date = $2", f.id, date);
}

// Live points for one player on one day
async function livePoints(userId, date, entry) {
  const [tasks, checkin] = await Promise.all([
    getTasks(userId, date),
    get("SELECT 1 FROM checkins WHERE user_id = $1 AND date = $2", userId, date),
  ]);
  const done = tasks.filter((t) => t.done).length;
  const quiz = (entry?.quiz_correct ?? 0) * POINTS.perQuestion;
  const taskPts = tasks.length ? Math.round((done / tasks.length) * POINTS.tasks) : 0;
  const checkinPts = checkin ? POINTS.checkin : 0;
  return {
    quiz, tasks: taskPts, checkin: checkinPts, total: quiz + taskPts + checkinPts,
    quizCorrect: entry?.quiz_correct ?? 0, tasksDone: done, tasksTotal: tasks.length, checkedIn: Boolean(checkin),
    submitted: Boolean(entry?.submitted_at),
  };
}

// Points frozen at the end of the day
function frozenPoints(entry) {
  if (!entry || entry.points == null) {
    return { quiz: 0, tasks: 0, checkin: 0, total: 0, quizCorrect: 0, tasksDone: 0, tasksTotal: 0, checkedIn: false, submitted: false };
  }
  const quiz = entry.quiz_correct * POINTS.perQuestion;
  const checkin = entry.checked_in ? POINTS.checkin : 0;
  return {
    quiz, tasks: entry.points - quiz - checkin, checkin, total: entry.points, quizCorrect: entry.quiz_correct,
    tasksDone: entry.tasks_done, tasksTotal: entry.tasks_total, checkedIn: entry.checked_in, submitted: Boolean(entry.submitted_at),
  };
}

async function duelView(uid, f, duel) {
  const entries = await all("SELECT * FROM duel_entries WHERE duel_id = $1", duel.id);
  const mine = entries.find((e) => e.user_id === uid);
  const theirs = entries.find((e) => e.user_id === f.friendId);
  const [me, them] = duel.finalized
    ? [frozenPoints(mine), frozenPoints(theirs)]
    : await Promise.all([livePoints(uid, duel.date, mine), livePoints(f.friendId, duel.date, theirs)]);
  const reveal = me.submitted || duel.finalized;
  // Before you play, you see THAT they played, not their quiz score
  const themView = reveal ? them : { ...them, quiz: null, quizCorrect: null, total: null };
  const leader = !reveal ? null : me.total === them.total ? "tie" : me.total > them.total ? "me" : "them";
  return {
    id: duel.id,
    date: duel.date,
    topic: duel.topic,
    questions: questionsView(duel.questions, mine?.answers, reveal),
    me,
    them: themView,
    finalized: duel.finalized,
    winner: duel.finalized ? (duel.winner_id === uid ? "me" : duel.winner_id ? "them" : "tie") : null,
    leader,
    points: POINTS,
  };
}

export async function todaysDuel(uid, friendshipId) {
  const f = await getFriendship(uid, friendshipId);
  await finalizePast(f.id);
  return duelView(uid, f, await getOrCreateDuel(uid, f, today()));
}

export async function submitDuel(uid, friendshipId, answers) {
  const f = await getFriendship(uid, friendshipId);
  const duel = await getOrCreateDuel(uid, f, today());
  if (duel.finalized) throw fail(409, "Today's duel is already over.");
  const { clean, correct } = grade(duel.questions, answers);
  // Only the first submission counts: "WHERE submitted_at IS NULL"
  const saved = await get(
    `INSERT INTO duel_entries (duel_id, user_id, answers, quiz_correct, submitted_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (duel_id, user_id) DO UPDATE SET answers = excluded.answers, quiz_correct = excluded.quiz_correct, submitted_at = now()
       WHERE duel_entries.submitted_at IS NULL
     RETURNING duel_id`,
    duel.id, uid, JSON.stringify(clean), correct,
  );
  if (!saved) throw fail(409, "You already played today's duel.");
  const [me, them] = await bothProfiles(uid, f);
  const theyPlayed = await get("SELECT 1 FROM duel_entries WHERE duel_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL", duel.id, f.friendId);
  notifyUser(
    f.friendId,
    "⚔️ Duel update",
    theyPlayed
      ? `${me.name} finished too: ${correct}/${duel.questions.length}. See who's leading!`
      : `${me.name} scored ${correct}/${duel.questions.length} in today's duel. Your move, ${them.name}!`,
    `/friends/${f.id}`,
  ).catch(() => {});
  return duelView(uid, f, duel);
}

// Freeze points, pick the winner, notify both. Safe to call twice.
export async function finalizeDuel(duel) {
  const f = await get("SELECT * FROM friendships WHERE id = $1", duel.friendship_id);
  if (!f) return null;
  const players = [];
  for (const userId of [f.requester_id, f.addressee_id]) {
    const entry = await get("SELECT * FROM duel_entries WHERE duel_id = $1 AND user_id = $2", duel.id, userId);
    const p = await livePoints(userId, duel.date, entry);
    await run(
      `INSERT INTO duel_entries (duel_id, user_id, tasks_done, tasks_total, checked_in, points)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (duel_id, user_id) DO UPDATE SET tasks_done = excluded.tasks_done, tasks_total = excluded.tasks_total,
         checked_in = excluded.checked_in, points = excluded.points`,
      duel.id, userId, p.tasksDone, p.tasksTotal, p.checkedIn, p.total,
    );
    players.push({ userId, total: p.total, at: entry?.submitted_at ? new Date(entry.submitted_at).getTime() : Infinity });
  }
  const [a, b] = players;
  let winner = null;
  if (a.total !== b.total) winner = a.total > b.total ? a : b;
  else if (a.total > 0 && a.at !== b.at) winner = a.at < b.at ? a : b; // tie -> finished the quiz first
  const done = await get(
    "UPDATE duels SET finalized = true, winner_id = $2 WHERE id = $1 AND NOT finalized RETURNING id",
    duel.id, winner?.userId ?? null,
  );
  // Notify only if WE finalized it, and someone actually played
  if (done && (a.total > 0 || b.total > 0)) {
    const profiles = await Promise.all(players.map((p) => getProfile(p.userId)));
    for (const [i, p] of players.entries()) {
      const other = players[1 - i];
      if (!profiles[i] || !profiles[1 - i]) continue;
      const won = winner ? winner.userId === p.userId : null;
      notifyUser(p.userId, "⚔️ Duel result", duelResultNote(profiles[i], profiles[1 - i].name, p.total, other.total, won), `/friends/${f.id}`).catch(() => {});
    }
  }
  return winner?.userId ?? null;
}

// Any earlier duel that wasn't finalized (server was off at night) -> finalize now
async function finalizePast(friendshipId) {
  const open = await all("SELECT * FROM duels WHERE friendship_id = $1 AND NOT finalized AND date < $2", friendshipId, today());
  for (const d of open) await finalizeDuel(d);
}

// The scheduler calls this at night for everyone
export async function finalizeDay(date = today()) {
  const open = await all("SELECT * FROM duels WHERE NOT finalized AND date <= $1", date);
  for (const d of open) {
    try {
      await finalizeDuel(d);
    } catch (err) {
      console.error(`Finalizing duel ${d.id} failed:`, err.message);
    }
  }
  return open.length;
}

// Head-to-head record + the last 10 duels
export async function rivalry(uid, friendshipId) {
  const f = await getFriendship(uid, friendshipId);
  await finalizePast(f.id);
  const rows = await all(
    `SELECT d.id, d.date, d.topic, d.winner_id, me.points AS my_points, them.points AS their_points
       FROM duels d
       LEFT JOIN duel_entries me ON me.duel_id = d.id AND me.user_id = $2
       LEFT JOIN duel_entries them ON them.duel_id = d.id AND them.user_id = $3
      WHERE d.friendship_id = $1 AND d.finalized
      ORDER BY d.date DESC`,
    f.id, uid, f.friendId,
  );
  const result = (r) => (r.winner_id === uid ? "W" : r.winner_id ? "L" : "T");
  // Current streak: how many duels in a row the same result
  let streak = 0;
  for (const r of rows) {
    if (result(r) !== result(rows[0])) break;
    streak++;
  }
  return {
    wins: rows.filter((r) => result(r) === "W").length,
    losses: rows.filter((r) => result(r) === "L").length,
    ties: rows.filter((r) => result(r) === "T").length,
    streak: rows.length ? { result: result(rows[0]), count: streak } : null,
    history: rows.slice(0, 10).map((r) => ({
      date: r.date, topic: r.topic, result: result(r), me: r.my_points ?? 0, them: r.their_points ?? 0,
    })),
  };
}

// =============================================================
// WEEKLY QUIZ
// =============================================================
export function weekStart(date = today()) {
  const d = new Date(date + "T00:00:00");
  const sinceMonday = (d.getDay() + 6) % 7; // Monday = 0 … Sunday = 6
  const offset = Math.round((d - new Date(today() + "T00:00:00")) / 86_400_000) - sinceMonday;
  return today(offset);
}

async function getOrCreateWeekly(uid, f) {
  const week = weekStart();
  const existing = await get("SELECT * FROM weekly_quizzes WHERE friendship_id = $1 AND week_start = $2", f.id, week);
  if (existing) return existing;
  const [me, them] = await bothProfiles(uid, f);
  const topics = sharedTopics(me, them);
  const questions = await pickFor(uid, topics, WEEKLY_SIZE, []);
  const created = await get(
    `INSERT INTO weekly_quizzes (friendship_id, week_start, topic, questions) VALUES ($1, $2, $3, $4)
     ON CONFLICT (friendship_id, week_start) DO NOTHING RETURNING *`,
    f.id, week, topicLabel(topics, me), JSON.stringify(questions),
  );
  return created ?? get("SELECT * FROM weekly_quizzes WHERE friendship_id = $1 AND week_start = $2", f.id, week);
}

async function weeklyView(uid, f, quiz) {
  const entries = await all("SELECT * FROM weekly_quiz_entries WHERE quiz_id = $1", quiz.id);
  const mine = entries.find((e) => e.user_id === uid);
  const theirs = entries.find((e) => e.user_id === f.friendId);
  const reveal = Boolean(mine);
  const result = mine && theirs ? (mine.correct === theirs.correct ? "tie" : mine.correct > theirs.correct ? "me" : "them") : null;
  return {
    id: quiz.id,
    weekStart: quiz.week_start,
    endsOn: today(Math.round((new Date(quiz.week_start + "T00:00:00") - new Date(today() + "T00:00:00")) / 86_400_000) + 6),
    topic: quiz.topic,
    questions: questionsView(quiz.questions, mine?.answers, reveal),
    me: { submitted: reveal, correct: mine?.correct ?? null },
    them: { submitted: Boolean(theirs), correct: reveal ? (theirs?.correct ?? null) : null },
    total: quiz.questions.length,
    result,
  };
}

export async function thisWeeksQuiz(uid, friendshipId) {
  const f = await getFriendship(uid, friendshipId);
  return weeklyView(uid, f, await getOrCreateWeekly(uid, f));
}

export async function submitWeekly(uid, friendshipId, answers) {
  const f = await getFriendship(uid, friendshipId);
  const quiz = await getOrCreateWeekly(uid, f);
  const { clean, correct } = grade(quiz.questions, answers);
  const saved = await get(
    `INSERT INTO weekly_quiz_entries (quiz_id, user_id, answers, correct) VALUES ($1, $2, $3, $4)
     ON CONFLICT (quiz_id, user_id) DO NOTHING RETURNING quiz_id`,
    quiz.id, uid, JSON.stringify(clean), correct,
  );
  if (!saved) throw fail(409, "You already took this week's quiz.");
  const me = await getProfile(uid);
  notifyUser(f.friendId, "📝 Weekly quiz", `${me.name} scored ${correct}/${quiz.questions.length} on this week's quiz. Beat that!`, `/friends/${f.id}`).catch(() => {});
  return weeklyView(uid, f, quiz);
}
