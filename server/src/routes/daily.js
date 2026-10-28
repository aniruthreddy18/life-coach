// =============================================================
// routes/daily.js — the daily loop
//   GET   /api/dashboard        -> everything the home screen needs
//   POST  /api/hello            -> count an app open, get a funny greeting
//   GET   /api/tasks/today      -> today's tasks (planned if missing)
//   PATCH /api/tasks/:id        -> mark a task done / not done
//   GET   /api/checkins/today   -> today's check-in (if any)
//   POST  /api/checkins         -> submit the evening check-in
// Every query is scoped to req.user.id (the signed-in student).
// =============================================================
import { Router } from "express";
import { get, today } from "../db.js";
import {
  getProfile, currentMilestone, getTasks, getStreak, getDailyStats,
} from "../state.js";
import { ensureTodayTasks, submitCheckin, nextGreeting } from "../coach.js";
import { liveScores } from "../rules.js";
import { getAIStatus, isOverBudget } from "../usage.js";
import { AI_ENABLED } from "../ai.js";

export const router = Router();

router.get("/dashboard", async (req, res) => {
  const uid = req.user.id;
  const profile = await getProfile(uid);
  if (!profile) return res.status(404).json({ error: "Not onboarded yet" });

  // Independent queries -> run them at the same time
  const [stats, milestone, tasks, streak, checkedIn, scores, overBudget, aiStatus] = await Promise.all([
    getDailyStats(uid, 14),
    currentMilestone(uid, profile),
    getTasks(uid, today()),
    getStreak(uid),
    get("SELECT 1 FROM checkins WHERE user_id = $1 AND date = $2", uid, today()),
    liveScores(uid, profile), // recalculated by rules from what you actually did
    isOverBudget(uid),
    getAIStatus(uid),
  ]);
  const last7 = stats.slice(-7);
  const total = last7.reduce((sum, d) => sum + d.total, 0);
  const done = last7.reduce((sum, d) => sum + d.done, 0);
  const moods = last7.filter((d) => d.mood).map((d) => d.mood);

  res.json({
    name: profile.name,
    assessment: profile.assessment,
    quizScore: profile.quiz_score,
    milestone,
    tasks,
    streak,
    completionRate: total ? Math.round((done / total) * 100) : null,
    avgMood: moods.length ? +(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null,
    checkedInToday: Boolean(checkedIn),
    stats,
    liveScores: scores,
    ai: { enabled: AI_ENABLED, overBudget, ...aiStatus },
  });
});

// The app calls this once each time it's opened
router.post("/hello", async (req, res) => {
  const hello = await nextGreeting(req.user.id);
  if (!hello) return res.status(404).json({ error: "Not onboarded yet" });
  res.json(hello);
});

router.get("/tasks/today", async (req, res) => {
  res.json(await ensureTodayTasks(req.user.id));
});

router.patch("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid task id" });
  if (typeof req.body.done !== "boolean") {
    return res.status(400).json({ error: "done must be true or false" });
  }
  // "AND user_id = $4": you can only tick YOUR OWN tasks
  const task = await get(
    "UPDATE tasks SET done = $1, done_at = $2 WHERE id = $3 AND user_id = $4 RETURNING *",
    req.body.done,
    req.body.done ? new Date().toISOString() : null,
    id,
    req.user.id,
  );
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

router.get("/checkins/today", async (req, res) => {
  res.json((await get("SELECT * FROM checkins WHERE user_id = $1 AND date = $2", req.user.id, today())) ?? null);
});

router.post("/checkins", async (req, res) => {
  const mood = Number(req.body.mood);
  const energy = Number(req.body.energy);
  const inRange = (n) => Number.isInteger(n) && n >= 1 && n <= 10;
  if (!inRange(mood) || !inRange(energy)) {
    return res.status(400).json({ error: "mood and energy must be whole numbers from 1 to 10" });
  }
  if (!(await getProfile(req.user.id))) return res.status(404).json({ error: "Not onboarded yet" });
  const result = await submitCheckin(req.user.id, {
    mood,
    energy,
    wins: String(req.body.wins ?? "").slice(0, 2000),
    blockers: String(req.body.blockers ?? "").slice(0, 2000),
  });
  res.status(201).json(result);
});
