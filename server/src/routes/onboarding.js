// =============================================================
// routes/onboarding.js
//   GET    /api/onboarding/questions  -> the 12 questions (public)
//   POST   /api/onboarding/quiz       -> a 5-question level test
//   POST   /api/onboarding/complete   -> score you + build the roadmap
//   GET    /api/profile               -> your saved profile (404 = first time)
//   DELETE /api/profile               -> wipe YOUR data and start over
// =============================================================
import { Router } from "express";
import { QUESTIONS } from "../questions.js";
import { generateQuiz, completeOnboarding } from "../coach.js";
import { getProfile, getMilestones } from "../state.js";
import { transaction } from "../db.js";

export const router = Router();

// Public: no sign-in needed to see the questions (mounted before auth in index.js)
export function listQuestions(req, res) {
  res.json(QUESTIONS);
}

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
  res.json(await generateQuiz(req.user.id, req.body.answers));
});

router.post("/onboarding/complete", async (req, res) => {
  const { answers, quiz } = req.body;
  const error = validateAnswers(answers);
  if (error) return res.status(400).json({ error });
  if (!Array.isArray(quiz) || quiz.length > 20) return res.status(400).json({ error: "quiz must be an array" });

  const result = await completeOnboarding(req.user.id, answers, quiz);
  res.status(201).json(result); // 201 = "Created"
});

router.get("/profile", async (req, res) => {
  const profile = await getProfile(req.user.id);
  // 404 tells the app "first time here -> show the 12 questions"
  if (!profile) return res.status(404).json({ error: "Not onboarded yet" });
  res.json({ ...profile, email: req.user.email, roadmap: await getMilestones(req.user.id) });
});

router.delete("/profile", async (req, res) => {
  const uid = req.user.id;
  // Only THIS student's rows. Their sign-in account itself stays.
  await transaction(async (q) => {
    for (const table of ["tasks", "milestones", "checkins", "messages", "memories", "reports", "profiles"]) {
      await q(`DELETE FROM ${table} WHERE user_id = $1`, uid);
    }
  });
  res.status(204).end(); // 204 = "No Content" (success, nothing to send back)
});
