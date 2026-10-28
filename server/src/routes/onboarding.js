// =============================================================
// routes/onboarding.js
//   GET    /api/onboarding/questions  -> the 12 questions
//   POST   /api/onboarding/quiz       -> AI makes a 5-question level test
//   POST   /api/onboarding/complete   -> AI scores you + builds the roadmap
//   GET    /api/profile               -> your saved profile
//   DELETE /api/profile               -> wipe everything and start over
// =============================================================
import { Router } from "express";
import { QUESTIONS } from "../questions.js";
import { generateQuiz, completeOnboarding } from "../coach.js";
import { getProfile, getMilestones } from "../state.js";
import { db } from "../db.js";

export const router = Router();

router.get("/onboarding/questions", (req, res) => {
  res.json(QUESTIONS);
});

// VALIDATION: never trust data from the client. Check it before using it.
function validateAnswers(answers) {
  if (!answers || typeof answers !== "object") return "answers must be an object";
  for (const q of QUESTIONS) {
    const v = answers[q.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty && q.type !== "multi") return `Please answer: "${q.text}"`;
    if (q.type === "choice" && !q.options.includes(v)) return `Invalid option for ${q.id}`;
  }
  return null;
}

router.post("/onboarding/quiz", async (req, res) => {
  const error = validateAnswers(req.body.answers);
  if (error) return res.status(400).json({ error });
  const quiz = await generateQuiz(req.body.answers);
  res.json(quiz);
});

router.post("/onboarding/complete", async (req, res) => {
  const { answers, quiz } = req.body;
  const error = validateAnswers(answers);
  if (error) return res.status(400).json({ error });
  if (!Array.isArray(quiz)) return res.status(400).json({ error: "quiz must be an array" });

  const result = await completeOnboarding(answers, quiz);
  res.status(201).json(result); // 201 = "Created"
});

router.get("/profile", (req, res) => {
  const profile = getProfile();
  if (!profile) return res.status(404).json({ error: "Not onboarded yet" });
  res.json({ ...profile, roadmap: getMilestones() });
});

router.delete("/profile", (req, res) => {
  db.exec(`
    DELETE FROM tasks; DELETE FROM milestones; DELETE FROM checkins;
    DELETE FROM messages; DELETE FROM memories; DELETE FROM reports; DELETE FROM profile;
    DELETE FROM settings WHERE key IN ('memory_summary', 'ai_status');
  `);
  res.status(204).end(); // 204 = "No Content" (success, nothing to send back)
});
