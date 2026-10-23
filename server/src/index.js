// =============================================================
// index.js — THE SERVER'S FRONT DOOR
// -------------------------------------------------------------
// Express listens for HTTP requests (e.g. GET /api/dashboard),
// passes them through "middleware" (like express.json(), which
// turns the JSON body into a JS object), then to the right ROUTE.
//
//   Browser --HTTP--> Express --> route --> coach.js --> DB / Claude
//   Browser <--JSON--  Express <------------ result
// =============================================================
import "./env.js"; // must be first!
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

import { router as onboarding } from "./routes/onboarding.js";
import { router as daily } from "./routes/daily.js";
import { router as chat } from "./routes/chat.js";
import { router as reports } from "./routes/reports.js";
import { router as notifications } from "./routes/notifications.js";
import { startScheduler } from "./scheduler.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// --- Middleware ---
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  // A tiny logger so you can SEE requests arrive in the terminal
  if (req.path.startsWith("/api")) console.log(`${req.method} ${req.path}`);
  next();
});

// --- API routes (all start with /api) ---
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", onboarding);
app.use("/api", daily);
app.use("/api", chat);
app.use("/api", reports);
app.use("/api", notifications);
app.use("/api", (req, res) => res.status(404).json({ error: "No such API route" }));

// --- Serve the built React app (after `npm run build`) ---
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Any other URL (/chat, /reports...) -> React decides what to show
  app.get("/{*path}", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// --- Error handler: any error thrown in a route ends up here ---
app.use((err, req, res, next) => {
  console.error(err);
  let status = err.status ?? 500;
  let message = err.message ?? "Something went wrong";

  if (err instanceof Anthropic.AuthenticationError) {
    status = 500;
    message = "Your Claude API key is invalid. Check ANTHROPIC_API_KEY in server/.env.";
  } else if (err instanceof Anthropic.RateLimitError) {
    status = 429;
    message = "The AI is busy (rate limit). Wait a minute and try again.";
  } else if (err instanceof Anthropic.APIError) {
    status = 502;
    message = `The AI service returned an error: ${err.message}`;
  }
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`✅ Life Coach API running at http://localhost:${PORT}`);
  startScheduler();
});
