// =============================================================
// scheduler.js — BACKGROUND JOBS (cron)
// -------------------------------------------------------------
// Most code runs when a REQUEST comes in. These jobs run on a
// CLOCK instead, even if nobody opens the app.
//
// Cron syntax: "minute hour day-of-month month day-of-week"
//   "30 7 * * *"  = every day at 07:30
//   "0 20 * * 0"  = every Sunday at 20:00
// Times are India time (APP_TIMEZONE), whatever the server's own clock says.
//
// Each job loops over every student who has notifications turned
// on, and sends them a funny line in THEIR language (messages.js).
// One student's error never stops the others (try/catch per student).
// =============================================================
import cron from "node-cron";
import { all, get, today, APP_TIMEZONE } from "./db.js";
import { getTasks } from "./state.js";
import { ensureTodayTasks, generateWeeklyReport } from "./coach.js";
import { notifyUser } from "./push.js";
import { eveningNote, nudgeNote, reportNote } from "./messages.js";
import { finalizeDay } from "./duels.js";

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

// Every student who finished onboarding (with or without notifications)
const allProfiles = () => all("SELECT * FROM profiles");

// Run job(profile) for each student, one at a time
function forEachStudent(name, job, who = subscribedProfiles) {
  return async () => {
    for (const profile of await who()) {
      try {
        await job(profile);
      } catch (err) {
        console.error(`${name} job failed for ${profile.name}:`, err.message);
      }
    }
  };
}

// The daily/weekly jobs. Exported so you can run one by hand:
//   node -e 'import("./src/scheduler.js").then(m => m.jobs.newDay())'
export const jobs = {
  // 12:01 AM: a new day for EVERY student. Yesterday's unfinished tasks
  // carry over (more work today) and today's new tasks are planned.
  newDay: forEachStudent("New day", async (p) => {
    const { tasks } = await ensureTodayTasks(p.user_id);
    console.log(`🌅 ${p.name}: ${tasks.length} task(s) for ${today()} (${tasks.filter((t) => t.from_date).length} carried over)`);
  }, allProfiles),

  // Morning: send today's plan ("Smooth start chesava master uu?")
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

  // Late night: close today's duels, pick winners, send the funny results
  duels: async () => {
    try {
      const n = await finalizeDay();
      if (n) console.log(`⚔️  Finalized ${n} duel(s)`);
    } catch (err) {
      console.error("Duel job failed:", err.message);
    }
  },

  // Sunday: weekly report
  weekly: forEachStudent("Weekly report", async (p) => {
    const report = await generateWeeklyReport(p.user_id);
    if (report) await notifyUser(p.user_id, `Weekly report: ${report.grade}`, reportNote(p, report.grade), "/reports");
  }),
};

export function startScheduler() {
  const at = (expr, job) => cron.schedule(expr, job, { timezone: APP_TIMEZONE });
  at(toCron(process.env.NEW_DAY_TIME, "00:01"), jobs.newDay);
  at(toCron(process.env.MORNING_TIME, "07:30"), jobs.morning);
  at(toCron(process.env.EVENING_TIME, "21:00"), jobs.evening);
  at(toCron(process.env.NUDGE_TIME, "22:30"), jobs.nudge);
  at("0 20 * * 0", jobs.weekly); // Sunday 8 PM
  at(toCron(process.env.DUEL_END_TIME, "23:55"), jobs.duels);
  console.log(`⏰ Scheduler running on ${APP_TIMEZONE} time (12:01 AM new day, morning plan, evening check-in, nudge, duel results, weekly report)`);
}
