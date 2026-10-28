// =============================================================
// usage.js — COST CONTROL: track every AI call + a daily budget
// -------------------------------------------------------------
// Every AI call saves a row in ai_usage (who, tokens, cost).
// Before each call, ai.js asks isOverBudget(uid). If THIS student's
// spending today has reached DAILY_BUDGET_USD, the app stops paying
// for AI for them until tomorrow and uses rules/templates (or a free
// model) instead. Each student has their own budget, so one heavy
// user can't use up everyone else's.
// =============================================================
import { all, get, run, today } from "./db.js";

// Daily limit per student in US dollars. 0.05 USD ≈ ₹4 a day.
export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 0.05);
// Only for showing rupees in the app; change it if the rate moves.
export const INR_PER_USD = Number(process.env.INR_PER_USD ?? 88);

// Price list in USD per 1 MILLION tokens: [input, output].
// OpenRouter tells us the real cost, so this is only used when the
// provider doesn't (OpenAI direct, Claude, Gemini). Prices change —
// check your provider's pricing page now and then.
const PRICES = {
  "gpt-6-luna": [0.1, 0.5],
  "gpt-6-sol": [2, 10],
  "gpt-6.1-sol": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "gemini-flash-latest": [0, 0], // free tier
};
const UNKNOWN_PRICE = [2, 10]; // careful guess for models not in the list

function priceFor(model) {
  if (model.endsWith(":free")) return [0, 0];
  const name = model.includes("/") ? model.split("/").pop() : model; // "openai/gpt-6-luna" -> "gpt-6-luna"
  return PRICES[name] ?? UNKNOWN_PRICE;
}

export function estimateCost(model, input, output) {
  const [inPrice, outPrice] = priceFor(model);
  return (input * inPrice + output * outPrice) / 1_000_000;
}

export async function recordUsage(uid, { feature, model, input, output, cost }) {
  const costUsd = cost ?? estimateCost(model, input, output);
  await run(
    `INSERT INTO ai_usage (user_id, day, feature, model, input_tokens, output_tokens, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    uid, today(), feature, model, input, output, costUsd,
  );
}

export async function spentToday(uid) {
  return (await get("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE user_id = $1 AND day = $2", uid, today())).total;
}

export async function isOverBudget(uid) {
  return DAILY_BUDGET_USD > 0 && (await spentToday(uid)) >= DAILY_BUDGET_USD;
}

// Remember whether the last AI call worked, so the app can show
// "Coach is in offline mode because…" instead of failing silently.
// (Only saved once the student has a profile row.)
export async function setAIStatus(uid, ok, reason = "") {
  await run(
    "UPDATE profiles SET ai_status = $2 WHERE user_id = $1",
    uid, JSON.stringify({ ok, reason, at: new Date().toISOString() }),
  );
}
export async function getAIStatus(uid) {
  const row = await get("SELECT ai_status FROM profiles WHERE user_id = $1", uid);
  return row?.ai_status ?? { ok: true, reason: "", at: null };
}

// Everything the Settings page shows about this student's usage
export async function usageSummary(uid) {
  const [todayRow, last7, byFeature, allTime, overBudget, aiStatus] = await Promise.all([
    get(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens), 0) AS input,
              COALESCE(SUM(output_tokens), 0) AS output, COALESCE(SUM(cost_usd), 0) AS cost
         FROM ai_usage WHERE user_id = $1 AND day = $2`,
      uid, today(),
    ),
    all(
      `SELECT day, COUNT(*) AS calls, SUM(cost_usd) AS cost
         FROM ai_usage WHERE user_id = $1 AND day >= $2 GROUP BY day ORDER BY day`,
      uid, today(-6),
    ),
    all(
      `SELECT feature, COUNT(*) AS calls, SUM(cost_usd) AS cost
         FROM ai_usage WHERE user_id = $1 AND day >= $2 GROUP BY feature ORDER BY cost DESC`,
      uid, today(-6),
    ),
    get("SELECT COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS cost FROM ai_usage WHERE user_id = $1", uid),
    isOverBudget(uid),
    getAIStatus(uid),
  ]);
  return { budgetUsd: DAILY_BUDGET_USD, inrPerUsd: INR_PER_USD, today: todayRow, overBudget, last7, byFeature, allTime, aiStatus };
}
