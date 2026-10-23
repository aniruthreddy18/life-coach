// =============================================================
// routes/reports.js
//   GET  /api/reports  -> all weekly reports, newest first
//   POST /api/reports  -> generate this week's report right now
// =============================================================
import { Router } from "express";
import { all } from "../db.js";
import { generateWeeklyReport } from "../coach.js";

export const router = Router();

router.get("/reports", (req, res) => {
  const rows = all("SELECT * FROM reports ORDER BY id DESC");
  res.json(rows.map((r) => ({ ...r, content: JSON.parse(r.content) })));
});

router.post("/reports", async (req, res) => {
  const report = await generateWeeklyReport();
  if (!report) return res.status(404).json({ error: "Not onboarded yet" });
  res.status(201).json(report);
});
