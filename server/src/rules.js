// =============================================================
// rules.js — THE FREE BRAIN (no AI, no cost)
// -------------------------------------------------------------
// Anything that is really just math or a template lives here:
//   - live scores computed from what you actually did
//   - weekly report numbers + grade
//   - coach messages from templates (per coach style)
//   - a generic 12-week roadmap + daily tasks when AI is off
// These run instantly, cost nothing and always give the same answer.
// The AI is only used on top, where it truly adds something.
// =============================================================
import { all, get, today } from "./db.js";
import { getStreak, getDailyStats, getTasks } from "./state.js";
import { morningNote } from "./messages.js";

// Answer to "How many hours a day?" -> minutes per day
export const MINUTES_PER_DAY = {
  "Less than 1 hour": 45,
  "1–2 hours": 90,
  "2–3 hours": 150,
  "3–5 hours": 240,
  "5+ hours": 300,
};
export const minutesFor = (hours) => MINUTES_PER_DAY[hours] ?? 90;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// Pick a message for the student's coach style, filling in {placeholders}
function say(templates, style, values = {}) {
  const list = templates[style] ?? templates.balanced;
  const text = list[Math.floor(Math.random() * list.length)];
  return text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

// -------------------------------------------------------------
// 1. SCORES
// -------------------------------------------------------------

// Starting scores when there's no AI to assess you (onboarding fallback)
export function baselineScores(answers, quizScore) {
  const selfRating = { "Complete beginner": 15, "I know the basics": 40, Intermediate: 65, Advanced: 85 }[answers.level] ?? 40;
  const skill = quizScore == null ? selfRating : (selfRating + quizScore * 2) / 3; // trust the quiz more
  const goalWords = String(answers.goal ?? "").trim().split(/\s+/).filter(Boolean).length;
  const hasNumbersOrDeadline = /\d|month|week|internship|job|exam|gate|cat|upsc/i.test(answers.goal ?? "");
  const problems = (answers.problems ?? []).length;
  return [
    { name: "Skill level", value: clamp(skill), reason: `Self-rating "${answers.level}" + quiz ${quizScore ?? "n/a"}/100.` },
    { name: "Goal clarity", value: clamp(Math.min(goalWords * 6, 70) + (hasNumbersOrDeadline ? 25 : 0)), reason: "Based on how specific your goal is." },
    { name: "Time available", value: clamp((minutesFor(answers.hours) / 300) * 100), reason: `You can give "${answers.hours}" a day.` },
    { name: "Focus & discipline", value: clamp(80 - problems * 10), reason: `${problems} blocker(s) picked during onboarding.` },
    { name: "Wellbeing", value: clamp((Number(answers.mood) || 5) * 10), reason: `You rated your mood ${answers.mood}/10.` },
    { name: "Consistency", value: 50, reason: "Starts at 50 — your daily check-ins will move it." },
  ];
}

// Live scores: recalculated from your real behaviour every time you open the app
export async function liveScores(uid, profile) {
  const baseline = Object.fromEntries(profile.assessment.scores.map((s) => [s.name, s.value]));
  const [stats, streak, doneRow] = await Promise.all([
    getDailyStats(uid, 14),
    getStreak(uid),
    get("SELECT COUNT(*) AS n FROM tasks WHERE user_id = $1 AND done", uid),
  ]);
  const daysSinceStart = Math.round((new Date(today() + "T00:00:00") - new Date(profile.start_date + "T00:00:00")) / 86_400_000) + 1;
  const window = Math.min(14, daysSinceStart);
  const recent = stats.slice(-window);

  const checkinDays = recent.filter((d) => d.mood != null).length;
  const tasksTotal = recent.reduce((s, d) => s + d.total, 0);
  const tasksDone = recent.reduce((s, d) => s + d.done, 0);
  const moods = stats.slice(-7).map((d) => d.mood).filter((m) => m != null);
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const doneEver = doneRow.n;

  return [
    {
      name: "Skill level",
      value: clamp((baseline["Skill level"] ?? 40) + doneEver * 0.5),
      reason: `Starting level ${baseline["Skill level"] ?? 40} + ${doneEver} completed task(s).`,
    },
    {
      name: "Consistency",
      value: tasksTotal || checkinDays ? pct(checkinDays, window) : baseline.Consistency ?? 50,
      reason: `Checked in ${checkinDays} of the last ${window} day(s). Streak: ${streak}.`,
    },
    {
      name: "Focus & discipline",
      value: tasksTotal ? pct(tasksDone, tasksTotal) : baseline["Focus & discipline"] ?? 50,
      reason: tasksTotal ? `Finished ${tasksDone} of ${tasksTotal} tasks recently.` : "No tasks yet — this updates as you work.",
    },
    {
      name: "Wellbeing",
      value: avgMood != null ? clamp(avgMood * 10) : baseline.Wellbeing ?? 50,
      reason: avgMood != null ? `Average mood ${avgMood.toFixed(1)}/10 this week.` : "From your onboarding answer.",
    },
    {
      name: "Time available",
      value: baseline["Time available"] ?? 50,
      reason: `Daily time: "${profile.answers.hours}".`,
    },
    {
      name: "Goal clarity",
      value: baseline["Goal clarity"] ?? 50,
      reason: "From your onboarding assessment.",
    },
  ];
}

// -------------------------------------------------------------
// 2. WEEKLY REPORT NUMBERS (pure SQL + math)
// -------------------------------------------------------------
export function gradeFor(completion, checkinDays, days = 7) {
  if (completion >= 85 && checkinDays >= days - 1) return "A";
  if (completion >= 70) return "B";
  if (completion >= 50) return "C";
  if (completion >= 30) return "D";
  return "F";
}

export async function weeklyNumbers(uid, profile, nextMilestone) {
  // A new student hasn't had 7 days yet — only count the days since they started
  const daysSinceStart = Math.round((new Date(today() + "T00:00:00") - new Date(profile.start_date + "T00:00:00")) / 86_400_000) + 1;
  const days = Math.max(1, Math.min(7, daysSinceStart));
  const stats = await getDailyStats(uid, days);
  const streak = await getStreak(uid);
  const total = stats.reduce((s, d) => s + d.total, 0);
  const done = stats.reduce((s, d) => s + d.done, 0);
  const completion = pct(done, total);
  const checkinDays = stats.filter((d) => d.mood != null).length;
  const moods = stats.map((d) => d.mood).filter((m) => m != null);
  const avgMood = moods.length ? +(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null;
  const best = [...stats].filter((d) => d.done).sort((a, b) => b.done / b.total - a.done / a.total)[0];
  const zeroDays = stats.filter((d) => d.total && d.done === 0).length;
  const blockers = (
    await all("SELECT blockers FROM checkins WHERE user_id = $1 AND date >= $2 AND blockers <> '' ORDER BY date", uid, today(-6))
  ).map((r) => r.blockers);

  const wins = [];
  if (done) wins.push(`Completed ${done} of ${total} tasks (${completion}%).`);
  if (checkinDays >= Math.ceil(days * 0.7)) wins.push(`Checked in on ${checkinDays} of ${days} day(s).`);
  if (best) wins.push(`Best day: ${best.date} (${best.done}/${best.total} tasks).`);
  if (streak >= 3) wins.push(`Current streak: ${streak} days.`);
  if (!wins.length) wins.push("You opened the app — that's the first step.");

  const problems = [];
  if (completion < 70) problems.push(`Only ${completion}% of tasks finished.`);
  if (zeroDays) problems.push(`${zeroDays} day(s) with zero tasks done.`);
  if (checkinDays < days) problems.push(`Missed ${days - checkinDays} check-in(s).`);
  if (blockers.length) problems.push(`Blockers you mentioned: ${blockers.slice(-2).join("; ")}`);
  if (avgMood != null && avgMood < 5) problems.push(`Mood was low (avg ${avgMood}/10). Rest matters too.`);
  if (!problems.length) problems.push("Nothing major — keep the same rhythm.");

  const nextWeekFocus = nextMilestone ? nextMilestone.goals.slice(0, 3) : ["Repeat this week's routine", "Finish carried-over tasks"];

  return { stats, days, total, done, completion, checkinDays, avgMood, grade: gradeFor(completion, checkinDays, days), wins, problems, nextWeekFocus };
}

// -------------------------------------------------------------
// 3. TEMPLATE MESSAGES (one set per coach style)
// -------------------------------------------------------------
const CHECKIN = {
  great: {
    gentle: ["Lovely work today, {name} — {done}/{total} done! 💛 Rest well and go again tomorrow."],
    balanced: ["{done}/{total} done, {name}. Solid day. Same energy tomorrow."],
    strict: ["{done}/{total}. Good. That's the standard now — don't drop it tomorrow."],
  },
  ok: {
    gentle: ["{done}/{total} today, {name}. Progress is progress. Tomorrow, start with the hardest task first."],
    balanced: ["{done}/{total} done. Decent, not great. Tomorrow: finish the leftover task before anything else."],
    strict: ["{done}/{total}? Half-done is not done, {name}. Tomorrow the leftover task comes FIRST. No excuses."],
  },
  bad: {
    gentle: ["Tough day, {name}? {done}/{total} done. Be kind to yourself — tomorrow, just do 20 minutes on the first task."],
    balanced: ["{done}/{total} today. It happens — but don't let it become a pattern. 20 minutes on task one tomorrow, first thing."],
    strict: ["{done}/{total}, {name}. That's not acceptable for your goal. Phone away tomorrow and start task one before breakfast."],
  },
};

export function checkinReply(profile, tasks, mood) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const ratio = total ? done / total : 0;
  const level = ratio >= 0.8 ? "great" : ratio >= 0.4 ? "ok" : "bad";
  let reply = say(CHECKIN[level], profile.coach_style, { name: profile.name, done, total });
  if (mood <= 3) reply += " Your mood is low today — talk to someone you trust. If it feels heavy, Tele-MANAS (14416) is free and 24/7.";
  return reply;
}

// The line above today's tasks: the same funny morning messages as the
// notification, in the student's own language (see messages.js)
export function morningMessage(profile, tasks) {
  return morningNote(profile, tasks);
}

const LETTERS = {
  gentle: "You showed up this week, {name}. {completion}% of tasks done — every bit counts. Next week, let's protect one focused hour every day.",
  balanced: "{name}, this week: {completion}% of tasks done, {checkins} check-ins. Keep what worked, fix one thing: {fix}",
  strict: "{name}: {completion}% done, grade {grade}. Your goal doesn't care about excuses. Next week, fix this first: {fix}",
};
export function weeklyLetter(profile, n) {
  const text = LETTERS[profile.coach_style] ?? LETTERS.balanced;
  return text.replace(/\{(\w+)\}/g, (_, k) =>
    ({ name: profile.name, completion: n.completion, checkins: `${n.checkinDays}/${n.days}`, grade: n.grade, fix: n.problems[0] })[k] ?? "");
}

export async function offlineChatReply(uid, profile, reason) {
  const [tasks, streak] = await Promise.all([getTasks(uid, today()), getStreak(uid)]);
  const left = tasks.filter((t) => !t.done);
  const lines = [
    `(Coach is in offline mode — ${reason})`,
    "",
    left.length
      ? `Here's what matters right now, ${profile.name}: "${left[0].title}"${left.length > 1 ? ` and ${left.length - 1} more task(s)` : ""}.`
      : `All of today's tasks are done, ${profile.name}. Great work — rest or revise.`,
    `Streak: ${streak} day(s). Do the next task, then come back and check in.`,
  ];
  return lines.join("\n");
}

// -------------------------------------------------------------
// 4. PLANS WITHOUT AI
// -------------------------------------------------------------
const PHASES = [
  { weeks: [1, 2, 3], title: "Foundations of {topic}", focus: "Learn the core basics properly.", goals: ["Learn the fundamentals of {topic}", "Make short notes for every concept", "Practise {n} small exercises"] },
  { weeks: [4, 5, 6], title: "Core practice: {topic}", focus: "Practise daily until the basics feel easy.", goals: ["Solve {n} practice problems", "Revise last week's notes", "Find and fix your 3 weakest topics"] },
  { weeks: [7, 8, 9], title: "Build with {topic}", focus: "Apply what you learned in a real project.", goals: ["Build a small project using {topic}", "Push your work to GitHub", "Explain your project out loud in 2 minutes"] },
  { weeks: [10, 11], title: "Advanced {topic} + revision", focus: "Go deeper and close the gaps.", goals: ["Study 2 advanced topics", "Solve {n} mixed problems", "Revise all notes once"] },
  { weeks: [12], title: "Final review & mock tests", focus: "Test yourself like it's the real thing.", goals: ["Take 2 timed mock tests", "Review every mistake", "Plan your next 3 months"] },
];

export function genericRoadmap(answers) {
  const topic = String(answers.learn ?? "your subject").split(/[,\n]/)[0].trim() || "your subject";
  const n = Math.max(5, Math.round(minutesFor(answers.hours) / 15)); // more time -> more problems
  const fill = (t) => t.replace(/\{topic\}/g, topic).replace(/\{n\}/g, n);
  return PHASES.flatMap((p) =>
    p.weeks.map((w) => ({ week_number: w, title: fill(p.title), focus: fill(p.focus), goals: p.goals.map(fill) })),
  );
}

// Turn a week's goals into daily tasks: cycles through the goals and
// adds a short revision task, sized to the student's daily minutes.
export function planDays(milestone, minutesPerDay, days) {
  const goals = milestone?.goals?.length ? milestone.goals : ["Study your main topic"];
  const perTask = Math.max(20, Math.round((minutesPerDay * 0.75) / 2));
  const plan = [];
  for (let d = 0; d < days; d++) {
    const goal = goals[d % goals.length];
    plan.push({
      day_offset: d,
      tasks: [
        { title: goal, details: `Work on this week's goal: "${goal}". Done = you can show something you made or solved.`, minutes: perTask },
        { title: "Revise yesterday's notes", details: "Read your notes and write 3 things you remember without looking.", minutes: Math.max(15, Math.round(minutesPerDay * 0.25)) },
      ],
    });
  }
  return plan;
}

export function baselineAssessment(answers, quizScore) {
  const scores = baselineScores(answers, quizScore);
  const skill = scores[0].value;
  const level = skill >= 70 ? "Advanced" : skill >= 40 ? "Intermediate" : "Beginner";
  return {
    summary: `You want to ${answers.goal}. You're starting at ${level.toLowerCase()} level with "${answers.hours}" a day. The plan below builds from basics to real projects in 12 weeks.`,
    level,
    scores,
    strengths: [`Clear interest in ${String(answers.learn).split(/[,\n]/)[0]}`, `You can give ${answers.hours} a day`, "You took the first step by setting this up"],
    weaknesses: (answers.problems ?? []).slice(0, 3).length ? answers.problems.slice(0, 3) : ["No routine yet", "No tracking yet", "Unclear daily plan"],
    first_message: `Welcome, ${answers.name}! Your 12-week plan is ready. Tomorrow we start with week 1. Check in every evening — I'll be watching. 💪`,
    memory_summary: `${answers.name}: ${answers.about}. Goal: ${answers.goal}. Learning: ${answers.learn}. Blockers: ${(answers.problems ?? []).join(", ") || "none listed"}.`,
  };
}
