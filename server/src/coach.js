// =============================================================
// coach.js — THE FEATURES (business logic)
// -------------------------------------------------------------
// Every feature follows the same COST-SMART recipe:
//
//   1. LIBRARY first  — already have this content saved? Use it (free)
//   2. AI next        — only for what needs real understanding (cheap
//                       "fast" model unless quality really matters)
//   3. RULES fallback — AI off / over budget / no credits / offline?
//                       Templates + math, so the app NEVER breaks (free)
//
// Every function takes `uid`, the signed-in student's id, and only
// ever reads or writes that student's rows.
// Routes (routes/*.js) call these; they don't talk to the AI directly.
// =============================================================
import { all, get, run, transaction, today } from "./db.js";
import { askJSON, streamText, coachPersona, AIUnavailable } from "./ai.js";
import {
  getProfile, buildContext, currentMilestone, currentWeekNumber, getMilestones, getTasks, setMemorySummary,
} from "./state.js";
import * as rules from "./rules.js";
import * as library from "./library.js";
import { greeting } from "./messages.js";

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

// Try the AI; if it's unavailable, use the rules version instead.
// The result says where it came from: source = "ai" | "rules".
async function aiOrRules(aiFn, rulesFn) {
  try {
    return { ...(await aiFn()), source: "ai" };
  } catch (err) {
    if (!(err instanceof AIUnavailable)) throw err; // a real bug — don't hide it
    console.warn(`⚠️  AI unavailable (${err.reason}): ${err.message} → using rules`);
    return { ...(await rulesFn()), source: "rules", aiNote: err.message };
  }
}

const withContext = async (uid, profile) => coachPersona(profile) + "\n\n# What you know\n" + (await buildContext(uid));

// ---- 1. Baseline quiz -----------------------------------------------------
export async function generateQuiz(uid, answers) {
  const topics = library.detectTopics(answers.learn);
  const keys = topics.length ? topics : [library.topicKeyFor(answers.learn)];

  // 1. Library: built-in bank (DSA, SQL, Python…) or questions the AI wrote before
  const saved = await library.pickQuestions(keys);
  if (saved.length >= 5) return { questions: saved, source: "library" };

  // 2. AI writes them ONCE; saved so the next student with this subject gets them free
  return aiOrRules(
    async () => {
      const result = await askJSON({
        uid,
        feature: "quiz",
        tier: "smart", // the answer key must be correct
        system:
          "You write short diagnostic quizzes that reveal a student's real level. Questions must be specific and answerable in under a minute each. Double-check that correct_index points to the truly correct option.",
        prompt: `A student wants to learn: ${answers.learn}
Their goal: ${answers.goal}
They rate themselves: ${answers.level}

Write exactly 5 multiple-choice questions (4 options each) that test their ACTUAL level in what they want to learn.
Order: 2 easy, 2 medium, 1 hard. correct_index is 0-3.`,
        schema: obj({
          questions: { type: "array", items: obj({ question: str, options: strList, correct_index: int, topic: str }) },
        }),
      });
      await library.saveQuestions(keys[0], result.questions);
      return { questions: result.questions };
    },
    // 3. Rules: general aptitude questions from the built-in bank
    async () => ({ questions: await library.pickQuestions(["aptitude"]) }),
  );
}

// ---- 2. Assessment + roadmap ---------------------------------------------
export async function completeOnboarding(uid, answers, quiz) {
  // Grade the quiz on the server
  const correct = quiz.filter((q) => q.chosen_index === q.correct_index).length;
  const quizScore = quiz.length ? Math.round((correct / quiz.length) * 100) : null;
  const quizSummary = quiz
    .map((q) => `- [${q.chosen_index === q.correct_index ? "RIGHT" : "WRONG"}] (${q.topic}) ${q.question}`)
    .join("\n");

  // The level is calculated by rules (free), so we can look up a saved roadmap
  const ruleBased = rules.baselineAssessment(answers, quizScore);
  const roadmapKey = library.roadmapKey(answers.learn, ruleBased.level, answers.hours);
  const persona = coachPersona({ name: answers.name, coach_style: answers.coach_style, language: answers.language });
  const answerLines = Object.entries(answers)
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");

  // Two independent jobs, run at the same time:
  const [assessment, roadmapResult] = await Promise.all([
    // (a) Personal assessment — short output, so the cheap "fast" model is fine
    aiOrRules(
      () =>
        askJSON({
          uid,
          feature: "assessment",
          tier: "fast",
          system: persona,
          prompt: `A new student just finished onboarding. Assess them honestly.

## Their answers
${answerLines}

## Baseline quiz: ${correct}/${quiz.length} correct (${quizScore}/100)
${quizSummary}

## What to return
- summary: 3-4 sentences on where they stand right now, written TO them ("You are...").
- level: their real level (trust the quiz over their self-rating).
- scores: exactly these 6, each 0-100 with a one-line reason:
  "Skill level", "Goal clarity", "Time available", "Focus & discipline", "Wellbeing", "Consistency".
- strengths / weaknesses: 3 each, specific.
- first_message: your first message to them as their coach (under 80 words).
- memory_summary: under 80 words, the key facts a coach must remember about them.`,
          schema: obj({
            summary: str,
            level: { type: "string", enum: ["Beginner", "Intermediate", "Advanced"] },
            scores: { type: "array", items: obj({ name: str, value: int, reason: str }) },
            strengths: strList,
            weaknesses: strList,
            first_message: str,
            memory_summary: str,
          }),
        }),
      () => ruleBased,
    ),

    // (b) Roadmap — library first, then the "smart" model, then a generic template
    (async () => {
      const saved = await library.findRoadmap(roadmapKey);
      if (saved) return { roadmap: saved, source: "library" };
      return aiOrRules(
        async () => {
          const { roadmap } = await askJSON({
            uid,
            feature: "roadmap",
            tier: "smart",
            effort: "medium",
            system: "You design realistic, week-by-week study roadmaps for students.",
            prompt: `Build a 12-week roadmap.
Goal: ${answers.goal}
Wants to learn: ${answers.learn}
Current level: ${ruleBased.level} (quiz ${quizScore}/100)
Time per day: ${answers.hours}

Exactly 12 weeks (week_number 1-12) taking them from their level to the goal.
Each week: a short title, a one-sentence focus, and 3-4 measurable goals sized to their daily time.
Keep it general to this goal and level (no names), so it can be reused for similar students.`,
            schema: obj({
              roadmap: { type: "array", items: obj({ week_number: int, title: str, focus: str, goals: strList }) },
            }),
          });
          await library.saveRoadmap(roadmapKey, roadmap);
          return { roadmap };
        },
        () => ({ roadmap: rules.genericRoadmap(answers) }),
      );
    })(),
  ]);

  const { source, aiNote, memory_summary, ...assessmentToSave } = assessment;

  // Save everything in ONE transaction: either all of it is saved, or none.
  // (Re-doing onboarding replaces this student's old plan.)
  await transaction(async (q) => {
    await q("DELETE FROM tasks WHERE user_id = $1", uid);
    await q("DELETE FROM milestones WHERE user_id = $1", uid);
    await q(
      `INSERT INTO profiles (user_id, name, answers, quiz_score, assessment, coach_style, language, start_date, memory_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         name = excluded.name, answers = excluded.answers, quiz_score = excluded.quiz_score,
         assessment = excluded.assessment, coach_style = excluded.coach_style, language = excluded.language,
         start_date = excluded.start_date, memory_summary = excluded.memory_summary`,
      uid,
      answers.name,
      JSON.stringify(answers),
      quizScore,
      JSON.stringify(assessmentToSave),
      answers.coach_style,
      answers.language,
      today(),
      memory_summary ?? "",
    );
    for (const w of roadmapResult.roadmap) {
      await q(
        "INSERT INTO milestones (user_id, week_number, title, focus, goals) VALUES ($1, $2, $3, $4, $5)",
        uid, w.week_number, w.title, w.focus, JSON.stringify(w.goals),
      );
    }
    await q("INSERT INTO messages (user_id, role, content) VALUES ($1, 'assistant', $2)", uid, assessment.first_message);
  });

  return {
    quizScore,
    assessment: { ...assessmentToSave, roadmap: roadmapResult.roadmap },
    sources: { assessment: source, roadmap: roadmapResult.source },
  };
}

// ---- 3. Tasks: planned a WEEK at a time ----------------------------------
// One AI call plans 7 days (instead of 7 calls). Each day, rules carry
// over up to 2 unfinished tasks from yesterday — no AI needed for that.
const planning = new Map(); // uid -> promise, so two requests share one plan

export async function ensureTodayTasks(uid) {
  const profile = await getProfile(uid);
  if (!profile) return { tasks: [], message: null };

  if (!(await getTasks(uid, today())).length) {
    if (!planning.has(uid)) planning.set(uid, planWeek(uid, profile).finally(() => planning.delete(uid)));
    await planning.get(uid);
  }
  await carryOverUnfinished(uid);
  const tasks = await getTasks(uid, today());
  return { tasks, message: rules.morningMessage(profile, tasks) };
}

async function carryOverUnfinished(uid) {
  const yesterday = today(-1);
  const unfinished = await all(
    "SELECT * FROM tasks WHERE user_id = $1 AND date = $2 AND NOT done AND NOT carried ORDER BY id LIMIT 2",
    uid, yesterday,
  );
  for (const t of unfinished) {
    const title = t.title.startsWith("↩ ") ? t.title : `↩ ${t.title}`;
    await run(
      "INSERT INTO tasks (user_id, date, title, details, minutes, milestone_id) VALUES ($1, $2, $3, $4, $5, $6)",
      uid, today(), title, t.details, t.minutes, t.milestone_id,
    );
  }
  await run("UPDATE tasks SET carried = true WHERE user_id = $1 AND date = $2 AND NOT done", uid, yesterday);
}

async function planWeek(uid, profile) {
  const DAYS = 7;
  const milestones = await getMilestones(uid);
  const startWeek = await currentWeekNumber(uid, profile);
  const minutes = rules.minutesFor(profile.answers.hours);
  const daysSinceStart = Math.round(
    (new Date(today() + "T00:00:00") - new Date(profile.start_date + "T00:00:00")) / 86_400_000,
  );
  const weekOf = (d) => Math.min(Math.floor((daysSinceStart + d) / 7) + 1, milestones.length || 1);
  // Which roadmap week each of the next 7 days belongs to
  const dayLines = [];
  for (let d = 0; d < DAYS; d++) {
    const m = milestones.find((x) => x.week_number === weekOf(d));
    dayLines.push(`- day_offset ${d} (${today(d)}): Week ${weekOf(d)} — ${m ? `${m.title}: ${m.goals.join("; ")}` : "general practice"}`);
  }

  const plan = await aiOrRules(
    async () =>
      askJSON({
        uid,
        feature: "weekly-plan",
        tier: "fast",
        system: await withContext(uid, profile),
        prompt: `Plan the student's next 7 days in ONE go.
${dayLines.join("\n")}

For each day_offset 0-6: 2 to 3 concrete tasks that fit about ${minutes} minutes in total.
Be specific: not "study DSA" but "Solve 3 easy array problems on LeetCode: Two Sum, Contains Duplicate, Best Time to Buy and Sell Stock".
Make day 6 lighter (revision). details: 1 sentence on what "done" means.`,
        schema: obj({
          days: {
            type: "array",
            items: obj({ day_offset: int, tasks: { type: "array", items: obj({ title: str, details: str, minutes: int }) } }),
          },
        }),
      }),
    () => ({ days: rules.planDays(milestones.find((m) => m.week_number === startWeek), minutes, DAYS) }),
  );

  for (const day of plan.days) {
    if (day.day_offset < 0 || day.day_offset >= DAYS) continue;
    const date = today(day.day_offset);
    if ((await getTasks(uid, date)).length) continue; // never overwrite a day that already has tasks
    const milestoneId = milestones.find((m) => m.week_number === weekOf(day.day_offset))?.id ?? null;
    for (const t of day.tasks) {
      await run(
        "INSERT INTO tasks (user_id, date, title, details, minutes, milestone_id) VALUES ($1, $2, $3, $4, $5, $6)",
        uid, date, t.title, t.details, t.minutes, milestoneId,
      );
    }
  }
}

// ---- 4. Evening check-in --------------------------------------------------
export async function submitCheckin(uid, { mood, energy, wins, blockers }) {
  const profile = await getProfile(uid);
  const tasks = await getTasks(uid, today());
  const doneCount = tasks.filter((t) => t.done).length;
  const wroteSomething = Boolean(wins.trim() || blockers.trim());

  // Nothing written? A template reply is just as good — and free.
  const result = !wroteSomething
    ? { reply: rules.checkinReply(profile, tasks, mood), new_memories: [], source: "rules" }
    : await aiOrRules(
        async () =>
          askJSON({
            uid,
            feature: "checkin",
            tier: "fast",
            system: await withContext(uid, profile),
            prompt: `The student just did their evening check-in.
Tasks done today: ${doneCount}/${tasks.length}
${tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.title}`).join("\n")}
Mood: ${mood}/10, Energy: ${energy}/10
Wins: ${wins || "(nothing written)"}
Blockers / excuses: ${blockers || "(nothing written)"}

- reply: respond as their coach (under 100 words). React to what they actually did. Praise real work; if they skipped tasks, hold them accountable in your style. End with one instruction for tomorrow.
- new_memories: 0-3 short, lasting facts worth remembering (patterns, recurring blockers, life events). Empty if nothing new.`,
            schema: obj({ reply: str, new_memories: strList }),
          }),
        () => ({ reply: rules.checkinReply(profile, tasks, mood), new_memories: [] }),
      );

  await run(
    `INSERT INTO checkins (user_id, date, mood, energy, wins, blockers, coach_reply)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, date) DO UPDATE SET mood = excluded.mood, energy = excluded.energy,
       wins = excluded.wins, blockers = excluded.blockers, coach_reply = excluded.coach_reply`,
    uid, today(), mood, energy, wins, blockers, result.reply,
  );
  for (const fact of result.new_memories) await run("INSERT INTO memories (user_id, fact) VALUES ($1, $2)", uid, fact);
  return result;
}

// ---- 5. Chat --------------------------------------------------------------
export async function chat(uid, userText, onText) {
  const profile = await getProfile(uid);
  await run("INSERT INTO messages (user_id, role, content) VALUES ($1, 'user', $2)", uid, userText);
  const saveReply = (reply) => run("INSERT INTO messages (user_id, role, content) VALUES ($1, 'assistant', $2)", uid, reply);

  // 1. Library: "explain recursion" asked before? Reuse the saved answer (free)
  const cacheKey = library.isCacheableQuestion(userText) ? library.explanationKey(userText, profile.language) : null;
  const saved = cacheKey && (await library.findExplanation(cacheKey));
  if (saved) {
    onText(saved);
    await saveReply(saved);
    return { reply: saved, source: "library" };
  }

  // 2. AI — with only the last 8 messages (plus the short memory) to keep it cheap
  const history = (
    await all("SELECT role, content FROM messages WHERE user_id = $1 ORDER BY id DESC LIMIT 8", uid)
  ).reverse();
  while (history.length && history[0].role !== "user") history.shift(); // must start with the user
  let streamed = false;
  try {
    const reply = await streamText({
      uid,
      feature: "chat",
      tier: "fast",
      system: await withContext(uid, profile),
      messages: history,
      onText: (piece) => {
        streamed = true;
        onText(piece);
      },
    });
    await saveReply(reply);
    if (cacheKey) await library.saveExplanation(cacheKey, userText, reply);
    return { reply, source: "ai" };
  } catch (err) {
    if (!(err instanceof AIUnavailable)) throw err;
    // 3. Rules: offline reply that still points to the next task
    const reply = await rules.offlineChatReply(uid, profile, err.message);
    onText((streamed ? "\n\n" : "") + reply);
    await saveReply(reply);
    return { reply, source: "rules" };
  }
}

// ---- 6. Weekly report -----------------------------------------------------
// Numbers, grade, wins and problems are calculated by rules (free).
// The AI only writes the headline + a personal letter, and refreshes
// the coach's memory summary at the same time (one call, two jobs).
export async function generateWeeklyReport(uid) {
  const profile = await getProfile(uid);
  if (!profile) return null;
  const week = await currentMilestone(uid, profile);
  const next = (await getMilestones(uid)).find((m) => m.week_number === (week?.week_number ?? 0) + 1) ?? week;
  const n = await rules.weeklyNumbers(uid, profile, next);
  const checkins = await all(
    "SELECT date, wins, blockers FROM checkins WHERE user_id = $1 AND date >= $2 ORDER BY date",
    uid, today(-6),
  );

  const written = await aiOrRules(
    async () =>
      askJSON({
        uid,
        feature: "weekly-report",
        tier: "smart",
        system: await withContext(uid, profile),
        prompt: `Write the personal part of the student's weekly report. The numbers are already calculated:
- Tasks: ${n.done}/${n.total} (${n.completion}%), check-ins: ${n.checkinDays}/${n.days} day(s), avg mood: ${n.avgMood ?? "n/a"}, grade: ${n.grade}
- Wins: ${n.wins.join("; ")}
- Problems: ${n.problems.join("; ")}
- Check-ins: ${checkins.map((c) => `${c.date}: ${c.wins || "-"} / ${c.blockers || "-"}`).join(" | ") || "none"}

Return:
- headline: one punchy line (under 12 words).
- coach_letter: a personal note (80-130 words) in your voice. Be honest about the grade.
- memory_summary: rewrite the coach's running summary of this student (under 100 words): who they are, goal, patterns, progress so far.
  Previous summary: ${profile.memory_summary || "(none)"}`,
        schema: obj({ headline: str, coach_letter: str, memory_summary: str }),
      }),
    () => ({
      headline: `Grade ${n.grade}: ${n.completion}% of tasks done`,
      coach_letter: rules.weeklyLetter(profile, n),
      memory_summary: "",
    }),
  );
  await setMemorySummary(uid, written.memory_summary);

  const report = {
    headline: written.headline,
    grade: n.grade,
    summary: `${n.done}/${n.total} tasks done (${n.completion}%), ${n.checkinDays}/${n.days} check-ins, average mood ${n.avgMood ?? "–"}/10.`,
    wins: n.wins,
    problems: n.problems,
    next_week_focus: n.nextWeekFocus,
    coach_letter: written.coach_letter,
    source: written.source,
  };
  await run("INSERT INTO reports (user_id, week_start, content) VALUES ($1, $2, $3)", uid, today(-6), JSON.stringify(report));
  return report;
}

// ---- 7. App-open greeting -------------------------------------------------
// Counts this student's app opens and returns the next funny line.
// UPDATE … RETURNING bumps the counter and reads it in one query.
export async function nextGreeting(uid) {
  const row = await get(
    "UPDATE profiles SET app_opens = app_opens + 1 WHERE user_id = $1 RETURNING app_opens, name, language",
    uid,
  );
  if (!row) return null;
  return { count: row.app_opens, message: greeting(row.language, row.app_opens, row.name) };
}
