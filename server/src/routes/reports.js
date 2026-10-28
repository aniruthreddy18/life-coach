// =============================================================
// routes/reports.js
//   GET  /api/reports  -> your weekly reports, newest first
//   POST /api/reports  -> generate this week's report right now
// =============================================================
import { Router } from "express";
import { all } from "../db.js";
import { generateWeeklyReport } from "../coach.js";

export const router = Router();

router.get("/reports", async (req, res) => {
  // content is jsonb, so it already arrives as an object
  res.json(await all("SELECT * FROM reports WHERE user_id = $1 ORDER BY id DESC", req.user.id));
});

router.post("/reports", async (req, res) => {
  const report = await generateWeeklyReport(req.user.id);
  if (!report) return res.status(404).json({ error: "Not onboarded yet" });
  res.status(201).json(report);
});
