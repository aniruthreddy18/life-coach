// =============================================================
// scheduler.js — BACKGROUND JOBS (cron)
// -------------------------------------------------------------
// Most code runs when a REQUEST comes in. These jobs run on a
// CLOCK instead, even if nobody opens the app.
//
// Cron syntax: "minute hour day-of-month month day-of-week"
//   "30 7 * * *"  = every day at 07:30
//   "0 20 * * 0"  = every Sunday at 20:00
// Times use the server's local time zone.
//
// Each job loops over every student who has notifications turned
// on, and sends them a funny line in THEIR language (messages.js).
// One student's error never stops the others (try/catch per student).
// =============================================================
import cron from "node-cron";
import { all, get, today } from "./db.js";
import { getTasks } from "./state.js";
import { ensureTodayTasks, generateWeeklyReport } from "./coach.js";
import { notifyUser } from "./push.js";
import { eveningNote, nudgeNote, reportNote } from "./messages.js";

function toCron(hhmm, fallback) {
  const [h, m] = (hhmm || fallback).split(":").map(Number);
  return `${m} ${h} * * *`;
}

// Students who finished onboarding AND allowed notifications
async function subscribedProfiles() {
  return all(
    `SELECT p.* FROM profiles p
      WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = p.user_id)`,
  );
}

// Run job(profile) for every subscribed student, one at a time
function forEachStudent(name, job) {
  return async () => {
    for (const profile of await subscribedProfiles()) {
      try {
        await job(profile);
      } catch (err) {
        console.error(`${name} job failed for ${profile.name}:`, err.message);
      }
    }
  };
}

// The four daily/weekly jobs. Exported so you can run one by hand:
//   node -e 'import("./src/scheduler.js").then(m => m.jobs.morning())'
export const jobs = {
  // Morning: make today's plan and send it ("Smooth start chesava master uu?")
  morning: forEachStudent("Morning", async (p) => {
    const { tasks, message } = await ensureTodayTasks(p.user_id);
    const list = tasks.map((t) => `• ${t.title}`).join("\n");
    await notifyUser(p.user_id, "Today's plan ☀️", `${message ?? ""}\n${list}`.trim(), "/");
  }),

  // Evening: time to check in ("Rey Kamal Haasan, what's the update?")
  evening: forEachStudent("Evening", async (p) => {
    const tasks = await getTasks(p.user_id, today());
    const done = tasks.filter((t) => t.done).length;
    await notifyUser(p.user_id, "Check-in time 🌙", eveningNote(p, done, tasks.length), "/checkin");
  }),

  // Late: nudge if there's still no check-in
  nudge: forEachStudent("Nudge", async (p) => {
    const checkedIn = await get("SELECT 1 FROM checkins WHERE user_id = $1 AND date = $2", p.user_id, today());
    if (!checkedIn) await notifyUser(p.user_id, "Coach 😤", nudgeNote(p), "/checkin");
  }),

  // Sunday: weekly report
  weekly: forEachStudent("Weekly report", async (p) => {
    const report = await generateWeeklyReport(p.user_id);
    if (report) await notifyUser(p.user_id, `Weekly report: ${report.grade}`, reportNote(p, report.grade), "/reports");
  }),
};

export function startScheduler() {
  cron.schedule(toCron(process.env.MORNING_TIME, "07:30"), jobs.morning);
  cron.schedule(toCron(process.env.EVENING_TIME, "21:00"), jobs.evening);
  cron.schedule(toCron(process.env.NUDGE_TIME, "22:30"), jobs.nudge);
  cron.schedule("0 20 * * 0", jobs.weekly); // Sunday 8 PM
  console.log("⏰ Scheduler running (morning plan, evening check-in, nudge, weekly report)");
}
