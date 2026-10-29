// =============================================================
// state.js — "WHAT IS THE CURRENT STATE OF THIS STUDENT?"
// -------------------------------------------------------------
// Functions that READ from the database and compute things:
// the profile, which week of the plan they're in, their streak,
// completion rates... Both the API routes and the AI use these.
//
// Every function takes `uid` (the signed-in user's id) and every
// query says "WHERE user_id = $1" — one student never sees another's data.
// =============================================================
import { all, get, run, today } from "./db.js";

export async function getProfile(uid) {
  return (await get("SELECT * FROM profiles WHERE user_id = $1", uid)) ?? null;
}

export async function getMilestones(uid) {
  return all("SELECT * FROM milestones WHERE user_id = $1 ORDER BY week_number", uid);
}

// Week 1 = the first 7 days after onboarding, and so on.
export async function currentWeekNumber(uid, profile) {
  const days = Math.round((new Date(today() + "T00:00:00") - new Date(profile.start_date + "T00:00:00")) / 86_400_000);
  const total = (await get("SELECT MAX(week_number) AS n FROM milestones WHERE user_id = $1", uid))?.n ?? 1;
  return Math.min(Math.floor(days / 7) + 1, total);
}

export async function currentMilestone(uid, profile) {
  const week = await currentWeekNumber(uid, profile);
  return (await get("SELECT * FROM milestones WHERE user_id = $1 AND week_number = $2", uid, week)) ?? null;
}

export async function getTasks(uid, date) {
  // Backlog (carried from earlier days) first, oldest first, then today's new tasks
  return all("SELECT * FROM tasks WHERE user_id = $1 AND date = $2 ORDER BY from_date NULLS LAST, id", uid, date);
}

// Streak = how many days in a row you checked in.
// Today counts if you've checked in; if not yet, the streak is still
// "alive" from yesterday (you have until tonight).
export async function getStreak(uid) {
  const rows = await all("SELECT date FROM checkins WHERE user_id = $1 AND date >= $2", uid, today(-400));
  const dates = new Set(rows.map((r) => r.date));
  let offset = dates.has(today()) ? 0 : -1;
  let streak = 0;
  while (dates.has(today(offset))) {
    streak++;
    offset--;
  }
  return streak;
}

// One row per day for the last N days — GROUP BY + SUM, the bread and
// butter of reports and dashboards. FILTER counts only the done tasks.
export async function getDailyStats(uid, days = 14) {
  const from = today(-(days - 1));
  const taskRows = await all(
    `SELECT date, COUNT(*) AS total, COUNT(*) FILTER (WHERE done) AS done
       FROM tasks WHERE user_id = $1 AND date BETWEEN $2 AND $3 GROUP BY date`,
    uid, from, today(),
  );
  const checkinRows = await all(
    "SELECT date, mood, energy FROM checkins WHERE user_id = $1 AND date >= $2",
    uid, from,
  );

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = today(-i);
    const t = taskRows.find((r) => r.date === date);
    const c = checkinRows.find((r) => r.date === date);
    result.push({ date, total: t?.total ?? 0, done: t?.done ?? 0, mood: c?.mood ?? null, energy: c?.energy ?? null });
  }
  return result;
}

export async function getMemories(uid, limit = 10) {
  const rows = await all("SELECT fact FROM memories WHERE user_id = $1 ORDER BY id DESC LIMIT $2", uid, limit);
  return rows.map((r) => r.fact);
}

export async function setMemorySummary(uid, text) {
  if (text) await run("UPDATE profiles SET memory_summary = $2 WHERE user_id = $1", uid, text);
}

// -------------------------------------------------------------
// THE COACH'S MEMORY. Every time we talk to the AI, we paste this
// text in, so it "knows" the student. This is how we personalise the
// AI WITHOUT fine-tuning: the right context, every single time.
//
// COST TRICK: we keep it SHORT — a ~100-word running summary
// (rewritten weekly by the AI), this week's plan, a one-line-per-day
// log, the last 3 check-ins and the 10 newest memory facts.
// -------------------------------------------------------------
const short = (text, max = 160) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
};

export async function buildContext(uid) {
  const p = await getProfile(uid);
  if (!p) return "The student has not completed onboarding yet.";

  const a = p.answers;
  const [week, tasksToday, stats, recentCheckins, memories, streak] = await Promise.all([
    currentMilestone(uid, p),
    getTasks(uid, today()),
    getDailyStats(uid, 7),
    all("SELECT date, wins, blockers FROM checkins WHERE user_id = $1 ORDER BY date DESC LIMIT 3", uid),
    getMemories(uid, 10),
    getStreak(uid),
  ]);

  const lines = [
    `Today is ${today()}.`,
    `## Who they are`,
    p.memory_summary ||
      `${p.name}. ${short(a.about)} Goal: ${short(a.goal)}. Learning: ${short(a.learn)}. Level: ${p.assessment.level}.`,
    `Daily time: ${a.hours}. Blockers: ${(a.problems ?? []).join(", ") || "none listed"}. Interests: ${short(a.interests, 80)}.`,
    `## This week`,
    week ? `Week ${week.week_number}: ${week.title} — ${week.goals.join("; ")}` : "No roadmap yet.",
    `## Today's tasks`,
    tasksToday.length ? tasksToday.map((t) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n") : "None planned yet.",
    `## Last 7 days (streak ${streak})`,
    stats.map((d) => `${d.date.slice(5)}: ${d.done}/${d.total}${d.mood ? ` m${d.mood}` : ""}`).join(" | "),
    `## Recent check-ins`,
    ...(recentCheckins.length
      ? recentCheckins.map((c) => `- ${c.date}: wins: ${short(c.wins, 100) || "-"} | blockers: ${short(c.blockers, 100) || "-"}`)
      : ["None yet."]),
    `## Facts you remember`,
    ...(memories.length ? memories.map((m) => `- ${m}`) : ["Nothing yet."]),
  ];
  return lines.join("\n");
}
