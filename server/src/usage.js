// =============================================================
// usage.js — COST CONTROL: track every AI call + a daily budget
// -------------------------------------------------------------
// Every AI call saves a row in the ai_usage table (tokens + cost).
// Before each call, ai.js asks isOverBudget(). If today's spending
// has reached DAILY_BUDGET_USD, the app stops paying for AI until
// tomorrow and uses rules/templates (or a free model) instead.
// =============================================================
import { all, get, run, today, getSetting, setSetting } from "./db.js";

// Daily limit in US dollars. 0.05 USD ≈ ₹4 a day ≈ ₹130 a month (max).
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

export function recordUsage({ feature, model, input, output, cost }) {
  const costUsd = cost ?? estimateCost(model, input, output);
  run(
    `INSERT INTO ai_usage (day, feature, model, input_tokens, output_tokens, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?)`,
    today(), feature, model, input, output, costUsd,
  );
}

export function spentToday() {
  return get("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE day = ?", today()).total;
}

export function isOverBudget() {
  return DAILY_BUDGET_USD > 0 && spentToday() >= DAILY_BUDGET_USD;
}

// Remember whether the last AI call worked, so the app can show
// "Coach is in offline mode because…" instead of failing silently.
export function setAIStatus(ok, reason = "") {
  setSetting("ai_status", JSON.stringify({ ok, reason, at: new Date().toISOString() }));
}
export function getAIStatus() {
  const raw = getSetting("ai_status");
  return raw ? JSON.parse(raw) : { ok: true, reason: "", at: null };
}

// Everything the Settings page shows about usage
export function usageSummary() {
  const todayRow = get(
    `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens), 0) AS input,
            COALESCE(SUM(output_tokens), 0) AS output, COALESCE(SUM(cost_usd), 0) AS cost
       FROM ai_usage WHERE day = ?`,
    today(),
  );
  const last7 = all(
    `SELECT day, COUNT(*) AS calls, SUM(cost_usd) AS cost
       FROM ai_usage WHERE day >= ? GROUP BY day ORDER BY day`,
    today(-6),
  );
  const byFeature = all(
    `SELECT feature, COUNT(*) AS calls, SUM(cost_usd) AS cost
       FROM ai_usage WHERE day >= ? GROUP BY feature ORDER BY cost DESC`,
    today(-6),
  );
  const allTime = get("SELECT COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS cost FROM ai_usage");
  return {
    budgetUsd: DAILY_BUDGET_USD,
    inrPerUsd: INR_PER_USD,
    today: todayRow,
    overBudget: isOverBudget(),
    last7,
    byFeature,
    allTime,
    aiStatus: getAIStatus(),
  };
}
