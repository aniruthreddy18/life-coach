// =============================================================
// state.js — "WHAT IS THE CURRENT STATE OF ME?"
// -------------------------------------------------------------
// Functions that READ from the database and compute things:
// your profile, which week of the plan you're in, your streak,
// completion rates... Both the API routes and the AI use these.
// =============================================================
import { all, get, today } from "./db.js";

export function getProfile() {
  const row = get("SELECT * FROM profile WHERE id = 1");
  if (!row) return null;
  // We stored JSON as text, so we parse it back into objects
  return { ...row, answers: JSON.parse(row.answers), assessment: JSON.parse(row.assessment) };
}

export function getMilestones() {
  return all("SELECT * FROM milestones ORDER BY week_number").map((m) => ({
    ...m,
    goals: JSON.parse(m.goals),
  }));
}

// Week 1 = the first 7 days after you onboarded, and so on.
export function currentWeekNumber(profile) {
  const start = new Date(profile.start_date + "T00:00:00");
  const now = new Date(today() + "T00:00:00");
  const days = Math.round((now - start) / 86_400_000);
  const total = get("SELECT MAX(week_number) AS n FROM milestones")?.n ?? 1;
  return Math.min(Math.floor(days / 7) + 1, total);
}

export function currentMilestone(profile) {
  const m = get("SELECT * FROM milestones WHERE week_number = ?", currentWeekNumber(profile));
  return m ? { ...m, goals: JSON.parse(m.goals) } : null;
}

export function getTasks(date) {
  return all("SELECT * FROM tasks WHERE date = ? ORDER BY id", date).map((t) => ({
    ...t,
    done: Boolean(t.done),
  }));
}

// Streak = how many days in a row you checked in.
// Today counts if you've checked in; if not yet, the streak is still
// "alive" from yesterday (you have until tonight).
export function getStreak() {
  const dates = new Set(all("SELECT date FROM checkins").map((r) => r.date));
  let offset = dates.has(today()) ? 0 : -1;
  let streak = 0;
  while (dates.has(today(offset))) {
    streak++;
    offset--;
  }
  return streak;
}

// One row per day for the last N days — an example of GROUP BY + SUM,
// the bread and butter of reports and dashboards.
export function getDailyStats(days = 14) {
  const from = today(-(days - 1));
  const taskRows = all(
    `SELECT date, COUNT(*) AS total, SUM(done) AS done
       FROM tasks WHERE date >= ? GROUP BY date`,
    from,
  );
  const checkinRows = all("SELECT date, mood, energy FROM checkins WHERE date >= ?", from);

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = today(-i);
    const t = taskRows.find((r) => r.date === date);
    const c = checkinRows.find((r) => r.date === date);
    result.push({
      date,
      total: t?.total ?? 0,
      done: t?.done ?? 0,
      mood: c?.mood ?? null,
      energy: c?.energy ?? null,
    });
  }
  return result;
}

export function getMemories(limit = 30) {
  return all("SELECT fact FROM memories ORDER BY id DESC LIMIT ?", limit).map((r) => r.fact);
}

// -------------------------------------------------------------
// THE COACH'S MEMORY. Every time we talk to the AI, we paste this
// text in, so it "knows" you. This is how we personalise the AI
// WITHOUT fine-tuning: the right context, every single time.
// -------------------------------------------------------------
export function buildContext() {
  const p = getProfile();
  if (!p) return "The student has not completed onboarding yet.";

  const a = p.assessment;
  const week = currentMilestone(p);
  const tasksToday = getTasks(today());
  const stats = getDailyStats(7);
  const recentCheckins = all(
    "SELECT date, mood, energy, wins, blockers FROM checkins ORDER BY date DESC LIMIT 5",
  );
  const memories = getMemories();

  const lines = [
    `Today is ${today()}.`,
    `## Student profile`,
    `Name: ${p.name}`,
    ...Object.entries(p.answers).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`),
    `Baseline quiz score: ${p.quiz_score ?? "n/a"}/100`,
    `## Your assessment from onboarding`,
    a.summary,
    `Level: ${a.level}`,
    `Scores: ${a.scores.map((s) => `${s.name} ${s.value}/100`).join(", ")}`,
    `Strengths: ${a.strengths.join("; ")}`,
    `Weaknesses: ${a.weaknesses.join("; ")}`,
    `## Plan`,
    week
      ? `Current: Week ${week.week_number} — ${week.title}. Focus: ${week.focus}. Goals: ${week.goals.join("; ")}`
      : "No roadmap yet.",
    `## Today's tasks`,
    tasksToday.length
      ? tasksToday.map((t) => `- [${t.done ? "x" : " "}] ${t.title} (${t.minutes} min)`).join("\n")
      : "None generated yet.",
    `## Last 7 days`,
    `Check-in streak: ${getStreak()} days`,
    ...stats.map(
      (d) => `- ${d.date}: tasks ${d.done}/${d.total}` + (d.mood ? `, mood ${d.mood}/10, energy ${d.energy}/10` : ", no check-in"),
    ),
    `## Recent check-ins`,
    ...(recentCheckins.length
      ? recentCheckins.map((c) => `- ${c.date}: wins: ${c.wins || "-"} | blockers: ${c.blockers || "-"}`)
      : ["None yet."]),
    `## Things you remember about them`,
    ...(memories.length ? memories.map((m) => `- ${m}`) : ["Nothing yet."]),
  ];
  return lines.join("\n");
}
