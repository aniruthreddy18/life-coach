// =============================================================
// index.js — THE SERVER'S FRONT DOOR
// -------------------------------------------------------------
// Express listens for HTTP requests (e.g. GET /api/dashboard),
// passes them through "middleware" (like express.json(), which
// turns the JSON body into a JS object), then to the right ROUTE.
//
//   Browser --HTTP + token--> Express --> requireUser --> route --> coach.js --> Postgres / AI
//   Browser <------JSON------ Express <----------------------------- result
//
// A few routes are PUBLIC (health, config, the 12 questions).
// Everything after app.use("/api", requireUser) needs a sign-in.
// =============================================================
import "./env.js"; // must be first!
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { router as onboarding, listQuestions } from "./routes/onboarding.js";
import { router as daily } from "./routes/daily.js";
import { router as chat } from "./routes/chat.js";
import { router as reports } from "./routes/reports.js";
import { router as notifications } from "./routes/notifications.js";
import { router as usage } from "./routes/usage.js";
import { requireUser, supabasePublicConfig } from "./auth.js";
import { startScheduler } from "./scheduler.js";
import { initPush } from "./push.js";
import { PROVIDER_NAME, MODELS } from "./ai.js";
import { seedQuestionBank } from "./library.js";
import { pool } from "./db.js";
import { DAILY_BUDGET_USD } from "./usage.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// --- Middleware ---
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  // A tiny logger so you can SEE requests arrive in the terminal
  if (req.path.startsWith("/api")) console.log(`${req.method} ${req.path}`);
  next();
});

// --- Public routes (no sign-in needed) ---
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/config", (req, res) => res.json(supabasePublicConfig())); // the browser needs these to show the sign-in screen
app.get("/api/onboarding/questions", listQuestions);

// --- Private routes: the sign-in check runs first ---
app.use("/api", requireUser);
app.use("/api", onboarding);
app.use("/api", daily);
app.use("/api", chat);
app.use("/api", reports);
app.use("/api", notifications);
app.use("/api", usage);
app.use("/api", (req, res) => res.status(404).json({ error: "No such API route" }));

// --- Serve the built React app (after `npm run build`) ---
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Any other URL (/chat, /reports...) -> React decides what to show
  app.get("/{*path}", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// --- Error handler: any error thrown in a route ends up here ---
// Database down? Say so clearly instead of a scary stack trace.
app.use((err, req, res, next) => {
  const dbDown = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "28P01", "3D000"].includes(err.code);
  if (dbDown) {
    console.error(`⚠️  Database problem (${err.code}): ${err.message} — run "npm run doctor"`);
    return res.status(503).json({ error: "Can't reach the database right now. Try again in a minute." });
  }
  console.error(err.status ? `⚠️  ${err.message}` : err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Something went wrong" });
});

// --- Start: check the database, then listen ---
async function start() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is missing in server/.env (README step 3a):");
    console.error("   Supabase dashboard → Connect → Session pooler → copy the URI → replace [YOUR-PASSWORD]");
    console.error("   → paste it as DATABASE_URL=... in server/.env → save. Then run: npm run doctor");
    process.exit(1);
  }
  try {
    await pool.query("SELECT 1");
    await seedQuestionBank(); // load the built-in level-test questions (safe every start)
    await initPush(); // notification keys
  } catch (err) {
    console.error(`❌ Can't use the database: ${err.message}`);
    console.error('   Run "npm run doctor" to find out why (and "npm run db:setup" if the tables are missing).');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✅ Life Coach API running at http://localhost:${PORT}`);
    console.log(`🤖 AI: ${PROVIDER_NAME} — smart: ${MODELS.smart}, fast: ${MODELS.fast}${MODELS.free ? `, free: ${MODELS.free}` : ""}`);
    console.log(`💰 Daily AI budget per student: $${DAILY_BUDGET_USD} (over budget → ${MODELS.free ? "free model" : "rules mode"})`);
    startScheduler();
  });
}
start();
