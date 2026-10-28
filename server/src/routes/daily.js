// =============================================================
// routes/daily.js — the daily loop
//   GET   /api/dashboard        -> everything the home screen needs
//   GET   /api/tasks/today      -> today's tasks (AI creates them if missing)
//   PATCH /api/tasks/:id        -> mark a task done / not done
//   GET   /api/checkins/today   -> today's check-in (if any)
//   POST  /api/checkins         -> submit the evening check-in
// =============================================================
import { Router } from "express";
import { get, run, today } from "../db.js";
import {
  getProfile, currentMilestone, getTasks, getStreak, getDailyStats,
} from "../state.js";
import { ensureTodayTasks, submitCheckin } from "../coach.js";
import { liveScores } from "../rules.js";
import { getAIStatus, isOverBudget } from "../usage.js";
import { AI_ENABLED } from "../ai.js";

export const router = Router();

router.get("/dashboard", (req, res) => {
  const profile = getProfile();
  if (!profile) return res.status(404).json({ error: "Not onboarded yet" });

  const stats = getDailyStats(14);
  const last7 = stats.slice(-7);
  const total = last7.reduce((sum, d) => sum + d.total, 0);
  const done = last7.reduce((sum, d) => sum + d.done, 0);
  const moods = last7.filter((d) => d.mood).map((d) => d.mood);

  res.json({
    name: profile.name,
    assessment: profile.assessment,
    quizScore: profile.quiz_score,
    milestone: currentMilestone(profile),
    tasks: getTasks(today()),
    streak: getStreak(),
    completionRate: total ? Math.round((done / total) * 100) : null,
    avgMood: moods.length ? +(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null,
    checkedInToday: Boolean(get("SELECT 1 FROM checkins WHERE date = ?", today())),
    stats,
    liveScores: liveScores(profile), // recalculated by rules from what you actually did
    ai: { enabled: AI_ENABLED, overBudget: isOverBudget(), ...getAIStatus() },
  });
});

router.get("/tasks/today", async (req, res) => {
  const result = await ensureTodayTasks();
  res.json(result);
});

router.patch("/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (typeof req.body.done !== "boolean") {
    return res.status(400).json({ error: "done must be true or false" });
  }
  const result = run(
    "UPDATE tasks SET done = ?, done_at = ? WHERE id = ?",
    req.body.done ? 1 : 0,
    req.body.done ? new Date().toISOString() : null,
    id,
  );
  if (result.changes === 0) return res.status(404).json({ error: "Task not found" });
  res.json(get("SELECT * FROM tasks WHERE id = ?", id));
});

router.get("/checkins/today", (req, res) => {
  res.json(get("SELECT * FROM checkins WHERE date = ?", today()) ?? null);
});

router.post("/checkins", async (req, res) => {
  const mood = Number(req.body.mood);
  const energy = Number(req.body.energy);
  const inRange = (n) => Number.isInteger(n) && n >= 1 && n <= 10;
  if (!inRange(mood) || !inRange(energy)) {
    return res.status(400).json({ error: "mood and energy must be whole numbers from 1 to 10" });
  }
  const result = await submitCheckin({
    mood,
    energy,
    wins: String(req.body.wins ?? "").slice(0, 2000),
    blockers: String(req.body.blockers ?? "").slice(0, 2000),
  });
  res.status(201).json(result);
});
