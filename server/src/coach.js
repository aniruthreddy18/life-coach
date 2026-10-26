// =============================================================
// coach.js — THE FEATURES (business logic)
// -------------------------------------------------------------
// Each function here follows the same recipe:
//   1. READ what we need from the database
//   2. ASK the AI (with a prompt + the student's context)
//   3. SAVE the AI's answer back into the database
// Routes (routes/*.js) call these; they don't talk to the AI directly.
// =============================================================
import { db, all, run, today } from "./db.js";
import { askJSON, streamText, coachPersona } from "./ai.js";
import { getProfile, buildContext, currentMilestone, getTasks, getDailyStats } from "./state.js";

// Helper to describe JSON shapes for the AI (JSON Schema).
// Every object must list its fields and forbid extra ones.
const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = { type: "string" };
const int = { type: "integer" };
const strList = { type: "array", items: str };

// ---- 1. Baseline quiz -----------------------------------------------------
export async function generateQuiz(answers) {
  const schema = obj({
    questions: {
      type: "array",
      items: obj({ question: str, options: strList, correct_index: int, topic: str }),
    },
  });
  return askJSON({
    system:
      "You write short diagnostic quizzes that reveal a student's real level. Questions must be specific and answerable in under a minute each. Double-check that correct_index points to the truly correct option.",
    tier: "smart", // one-time, and the answer key must be correct
    prompt: `A student wants to learn: ${answers.learn}
Their goal: ${answers.goal}
They rate themselves: ${answers.level}

Write exactly 5 multiple-choice questions (4 options each) that test their ACTUAL level in what they want to learn.
Go from easy to hard: 2 easy, 2 medium, 1 hard. correct_index is 0-3.`,
    schema,
  });
}

// ---- 2. Assessment + roadmap ---------------------------------------------
export async function completeOnboarding(answers, quiz) {
  // Grade the quiz on the server
  const correct = quiz.filter((q) => q.chosen_index === q.correct_index).length;
  const quizScore = quiz.length ? Math.round((correct / quiz.length) * 100) : null;
  const quizSummary = quiz
    .map((q) => `- [${q.chosen_index === q.correct_index ? "RIGHT" : "WRONG"}] (${q.topic}) ${q.question}`)
    .join("\n");

  const schema = obj({
    summary: str,
    level: { type: "string", enum: ["Beginner", "Intermediate", "Advanced"] },
    scores: { type: "array", items: obj({ name: str, value: int, reason: str }) },
    strengths: strList,
    weaknesses: strList,
    roadmap: {
      type: "array",
      items: obj({ week_number: int, title: str, focus: str, goals: strList }),
    },
    first_message: str,
  });

  const assessment = await askJSON({
    system: coachPersona({ coach_style: answers.coach_style, language: answers.language }),
    tier: "smart", // one-time: your roadmap deserves the best model
    effort: "medium",
    prompt: `A new student just finished onboarding. Assess them honestly and build their plan.

## Their answers
${Object.entries(answers).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n")}

## Baseline quiz: ${correct}/${quiz.length} correct (${quizScore}/100)
${quizSummary}

## What to return
- summary: 3-4 sentences on where they stand right now, written TO them ("You are...").
- level: their real level (trust the quiz over their self-rating).
- scores: exactly these 6, each 0-100 with a one-line reason:
  "Skill level", "Goal clarity", "Time available", "Focus & discipline", "Wellbeing", "Consistency".
- strengths / weaknesses: 3 each, specific.
- roadmap: exactly 12 weeks (week_number 1-12) that take them from where they are to their goal.
  Each week: a short title, one-sentence focus, and 3-4 measurable goals sized to their available hours.
- first_message: your first message to them as their coach (under 80 words): what you see, and what we start with tomorrow.`,
    schema,
  });

  // Save everything in ONE transaction: either all of it is saved, or none.
  db.exec("BEGIN");
  try {
    run("DELETE FROM tasks");
    run("DELETE FROM milestones");
    run("DELETE FROM profile");
    run(
      `INSERT INTO profile (id, name, answers, quiz_score, assessment, coach_style, language, start_date)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
      answers.name,
      JSON.stringify(answers),
      quizScore,
      JSON.stringify(assessment),
      answers.coach_style,
      answers.language,
      today(),
    );
    for (const w of assessment.roadmap) {
      run(
        "INSERT INTO milestones (week_number, title, focus, goals) VALUES (?, ?, ?, ?)",
        w.week_number,
        w.title,
        w.focus,
        JSON.stringify(w.goals),
      );
    }
    run("INSERT INTO messages (role, content) VALUES ('assistant', ?)", assessment.first_message);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { quizScore, assessment };
}

// ---- 3. Today's tasks -----------------------------------------------------
// If two requests arrive at once, we don't want to generate tasks twice.
// So we remember the "in-progress" promise and share it.
let generating = null;

export async function ensureTodayTasks() {
  const existing = getTasks(today());
  if (existing.length) return { tasks: existing, message: null };
  if (!getProfile()) return { tasks: [], message: null };

  generating ??= generateTodayTasks().finally(() => (generating = null));
  return generating;
}

async function generateTodayTasks() {
  const profile = getProfile();
  const milestone = currentMilestone(profile);
  const yesterdayUnfinished = all(
    "SELECT title FROM tasks WHERE date = ? AND done = 0",
    today(-1),
  ).map((t) => t.title);

  const schema = obj({
    tasks: { type: "array", items: obj({ title: str, details: str, minutes: int }) },
    morning_message: str,
  });

  const result = await askJSON({
    system: coachPersona(profile) + "\n\n# What you know\n" + buildContext(),
    prompt: `Plan TODAY's tasks for the student.
- 2 to 4 tasks that move them toward this week's goals (Week ${milestone?.week_number}: ${milestone?.title}).
- Total time should fit their available hours ("${profile.answers.hours}").
- Be concrete: not "study DSA" but "Solve 3 easy array problems on LeetCode: Two Sum, Best Time to Buy and Sell Stock, Contains Duplicate".
- details: 1-2 sentences on how to do it / what "done" means.
${yesterdayUnfinished.length ? `- Yesterday they did NOT finish: ${yesterdayUnfinished.join("; ")}. Carry over what matters.` : ""}
- morning_message: a short (under 40 words) message for their morning notification, in your coach voice.`,
    schema,
  });

  for (const t of result.tasks) {
    run(
      "INSERT INTO tasks (date, title, details, minutes, milestone_id) VALUES (?, ?, ?, ?, ?)",
      today(),
      t.title,
      t.details,
      t.minutes,
      milestone?.id ?? null,
    );
  }
  return { tasks: getTasks(today()), message: result.morning_message };
}

// ---- 4. Evening check-in --------------------------------------------------
export async function submitCheckin({ mood, energy, wins, blockers }) {
  const profile = getProfile();
  const tasks = getTasks(today());
  const doneCount = tasks.filter((t) => t.done).length;

  const schema = obj({ reply: str, new_memories: strList });
  const result = await askJSON({
    system: coachPersona(profile) + "\n\n# What you know\n" + buildContext(),
    prompt: `The student just did their evening check-in.
Tasks done today: ${doneCount}/${tasks.length}
${tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n")}
Mood: ${mood}/10, Energy: ${energy}/10
Wins: ${wins || "(nothing written)"}
Blockers / excuses: ${blockers || "(nothing written)"}

- reply: respond as their coach (under 100 words). React to what they actually did. Praise real work; if they skipped tasks, hold them accountable in your style. End with one instruction for tomorrow.
- new_memories: 0-3 short, lasting facts worth remembering about them from this check-in (patterns, recurring blockers, life events). Empty if nothing new.`,
    schema,
  });

  run(
    `INSERT INTO checkins (date, mood, energy, wins, blockers, coach_reply)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, energy = excluded.energy,
       wins = excluded.wins, blockers = excluded.blockers, coach_reply = excluded.coach_reply`,
    today(),
    mood,
    energy,
    wins,
    blockers,
    result.reply,
  );
  for (const fact of result.new_memories) run("INSERT INTO memories (fact) VALUES (?)", fact);
  return result;
}

// ---- 5. Chat --------------------------------------------------------------
export async function chat(userText, onText) {
  const profile = getProfile();
  run("INSERT INTO messages (role, content) VALUES ('user', ?)", userText);

  // The API is "stateless": it forgets everything between calls.
  // So we send the recent conversation every time.
  const history = all("SELECT role, content FROM messages ORDER BY id DESC LIMIT 30").reverse();
  // A conversation must start with a user message
  while (history.length && history[0].role !== "user") history.shift();

  const reply = await streamText({
    system: coachPersona(profile) + "\n\n# What you know\n" + buildContext(),
    messages: history.map(({ role, content }) => ({ role, content })),
    onText,
  });
  run("INSERT INTO messages (role, content) VALUES ('assistant', ?)", reply);
  return reply;
}

// ---- 6. Weekly report -----------------------------------------------------
export async function generateWeeklyReport() {
  const profile = getProfile();
  if (!profile) return null;
  const stats = getDailyStats(7);
  const tasks = all("SELECT date, title, done FROM tasks WHERE date >= ? ORDER BY date", today(-6));
  const checkins = all("SELECT * FROM checkins WHERE date >= ? ORDER BY date", today(-6));

  const schema = obj({
    headline: str,
    grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    summary: str,
    wins: strList,
    problems: strList,
    next_week_focus: strList,
    coach_letter: str,
  });

  const report = await askJSON({
    system: coachPersona(profile) + "\n\n# What you know\n" + buildContext(),
    tier: "smart", // once a week, worth the better model
    effort: "medium",
    prompt: `Write the student's weekly report for the last 7 days.

## Daily numbers
${stats.map((d) => `- ${d.date}: tasks ${d.done}/${d.total}, mood ${d.mood ?? "-"}, energy ${d.energy ?? "-"}`).join("\n")}

## All tasks
${tasks.map((t) => `- ${t.date} [${t.done ? "x" : " "}] ${t.title}`).join("\n") || "none"}

## Check-ins
${checkins.map((c) => `- ${c.date}: wins: ${c.wins || "-"}; blockers: ${c.blockers || "-"}`).join("\n") || "none"}

Be honest. grade = how well they executed this week. wins/problems/next_week_focus: 2-4 items each.
coach_letter: a personal note (80-150 words) in your voice.`,
    schema,
  });

  run("INSERT INTO reports (week_start, content) VALUES (?, ?)", today(-6), JSON.stringify(report));
  return report;
}
