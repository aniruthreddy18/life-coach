// =============================================================
// scheduler.js — BACKGROUND JOBS (cron)
// -------------------------------------------------------------
// Most code runs when a REQUEST comes in. These jobs run on a
// CLOCK instead, even if nobody opens the app.
//
// Cron syntax: "minute hour day-of-month month day-of-week"
//   "30 7 * * *"  = every day at 07:30
//   "0 20 * * 0"  = every Sunday at 20:00
// Times use your computer's local time zone.
// =============================================================
import cron from "node-cron";
import { get, today } from "./db.js";
import { getProfile, getTasks } from "./state.js";
import { ensureTodayTasks, generateWeeklyReport } from "./coach.js";
import { notifyAll } from "./push.js";

function toCron(hhmm, fallback) {
  const [h, m] = (hhmm || fallback).split(":").map(Number);
  return `${m} ${h} * * *`;
}

const NUDGES = {
  gentle: "Hey, you haven't checked in today. Even 2 minutes counts 💛",
  balanced: "No check-in yet today. Open the app and tell me how it went.",
  strict: "Still no check-in? Discipline isn't optional. Open the app. Now.",
};

export function startScheduler() {
  // Morning: make today's plan and send it
  cron.schedule(toCron(process.env.MORNING_TIME, "07:30"), async () => {
    if (!getProfile()) return;
    try {
      const { tasks, message } = await ensureTodayTasks();
      const list = tasks.map((t) => `• ${t.title}`).join("\n");
      await notifyAll("Today's plan", `${message ?? ""}\n${list}`.trim(), "/");
    } catch (err) {
      console.error("Morning job failed:", err.message);
    }
  });

  // Evening: time to check in
  cron.schedule(toCron(process.env.EVENING_TIME, "21:00"), async () => {
    if (!getProfile()) return;
    const tasks = getTasks(today());
    const done = tasks.filter((t) => t.done).length;
    await notifyAll("Check-in time", `You finished ${done}/${tasks.length} tasks today. How did it go?`, "/checkin");
  });

  // Late: nudge (harder) if there's still no check-in
  cron.schedule(toCron(process.env.NUDGE_TIME, "22:30"), async () => {
    const profile = getProfile();
    if (!profile) return;
    const checkedIn = get("SELECT 1 FROM checkins WHERE date = ?", today());
    if (!checkedIn) await notifyAll("Coach", NUDGES[profile.coach_style] ?? NUDGES.balanced, "/checkin");
  });

  // Sunday 8 PM: weekly report
  cron.schedule("0 20 * * 0", async () => {
    try {
      const report = await generateWeeklyReport();
      if (report) await notifyAll(`Weekly report: ${report.grade}`, report.headline, "/reports");
    } catch (err) {
      console.error("Weekly report failed:", err.message);
    }
  });

  console.log("⏰ Scheduler running (morning plan, evening check-in, nudge, weekly report)");
}
