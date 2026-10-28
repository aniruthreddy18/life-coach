// =============================================================
// routes/usage.js
//   GET /api/usage  -> AI spending today/this week, budget, AI status,
//                      and how much the content library is saving
// =============================================================
import { Router } from "express";
import { usageSummary } from "../usage.js";
import { libraryStats } from "../library.js";
import { PROVIDER_NAME, MODELS, AI_ENABLED } from "../ai.js";

export const router = Router();

router.get("/usage", (req, res) => {
  res.json({
    provider: PROVIDER_NAME,
    aiEnabled: AI_ENABLED,
    models: MODELS,
    ...usageSummary(),
    library: libraryStats(),
  });
});
