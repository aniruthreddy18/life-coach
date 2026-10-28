// =============================================================
// ai.js — THE ONE DOOR TO THE AI
// -------------------------------------------------------------
// The rest of the app only ever calls askJSON() and streamText()
// from this file. WHICH AI company answers is decided here, from
// AI_PROVIDER in server/.env:
//
//   AI_PROVIDER=openrouter -> providers/openrouter.js (GPT Sol + Luna via OpenRouter)
//   AI_PROVIDER=openai     -> providers/openai.js     (GPT, direct from OpenAI)
//   AI_PROVIDER=gemini     -> providers/gemini.js     (free tier)
//   AI_PROVIDER=claude     -> providers/claude.js     (Opus + Haiku)
//   AI_PROVIDER=none       -> no AI at all: rules + templates only (free)
//
// Two patterns:
//   1. askJSON()    -> we need DATA back (scores, a plan, tasks).
//                      We give the AI a JSON Schema and it MUST reply
//                      in exactly that shape ("structured output").
//   2. streamText() -> we need a chat reply, shown word-by-word.
//
// tier: "smart" for one-time/weekly jobs, "fast" for everyday jobs.
//
// COST CONTROL lives here too. Every call:
//   1. checks today's budget (usage.js) -> over budget? use the free
//      model if one is set, otherwise refuse
//   2. calls the provider
//   3. records tokens + cost
// If the AI can't be used (off, over budget, no credits, network down…)
// we throw AIUnavailable. coach.js catches it and uses rules instead,
// so the app keeps working.
// =============================================================
import * as openrouter from "./providers/openrouter.js";
import * as openai from "./providers/openai.js";
import * as gemini from "./providers/gemini.js";
import * as claude from "./providers/claude.js";
import { recordUsage, isOverBudget, setAIStatus, DAILY_BUDGET_USD } from "./usage.js";

const none = {
  MODELS: { smart: "(none)", fast: "(none)" },
  listModels: async () => [],
};

const PROVIDERS = { openrouter, openai, gemini, claude, none };
export const PROVIDER_NAME = (process.env.AI_PROVIDER || "openrouter").toLowerCase();
const provider = PROVIDERS[PROVIDER_NAME];
if (!provider) {
  throw new Error(`Unknown AI_PROVIDER "${PROVIDER_NAME}" in server/.env. Use one of: ${Object.keys(PROVIDERS).join(", ")}.`);
}
export const AI_ENABLED = PROVIDER_NAME !== "none";
export const MODELS = provider.MODELS;
export const listModels = provider.listModels;

export class AIUnavailable extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason; // "off" | "budget" | "error"
  }
}

// Decide which model tier to use right now for this student (or refuse)
async function chooseTier(uid, tier) {
  if (!AI_ENABLED) throw new AIUnavailable("off", "AI is turned off (AI_PROVIDER=none).");
  if (await isOverBudget(uid)) {
    if (MODELS.free) return "free";
    throw new AIUnavailable("budget", `Today's AI budget ($${DAILY_BUDGET_USD}) is used up. Back tomorrow!`);
  }
  return tier;
}

// uid = the student this call is for (budget + usage are per student)
// feature = a label for the usage table ("quiz", "chat", ...)
export async function askJSON({ uid, feature, system, prompt, schema, tier = "fast", effort = "low" }) {
  const useTier = await chooseTier(uid, tier);
  let result;
  try {
    result = await provider.askJSON({ system, prompt, schema, tier: useTier, effort });
  } catch (err) {
    await setAIStatus(uid, false, err.message);
    throw new AIUnavailable("error", err.message);
  }
  await recordUsage(uid, { feature, model: MODELS[useTier], ...result.usage });
  await setAIStatus(uid, true);
  return result.data;
}

// onText is called with each small piece of text as it arrives.
export async function streamText({ uid, feature, system, messages, onText, tier = "fast", effort = "low" }) {
  const useTier = await chooseTier(uid, tier);
  let result;
  try {
    result = await provider.streamText({ system, messages, onText, tier: useTier, effort });
  } catch (err) {
    await setAIStatus(uid, false, err.message);
    throw new AIUnavailable("error", err.message);
  }
  await recordUsage(uid, { feature, model: MODELS[useTier], ...result.usage });
  await setAIStatus(uid, true);
  return result.text;
}

// -------------------------------------------------------------
// THE COACH'S PERSONALITY (the "system prompt").
// This is prompt engineering: we describe who the AI should be.
// The student's own choices (style + language) change it.
// -------------------------------------------------------------
const STYLES = {
  gentle:
    "Be warm, patient and encouraging. When they slip, be understanding but still honest about what needs to change.",
  balanced:
    "Be friendly and supportive, but direct. Praise real effort, and call out excuses plainly when you see them.",
  strict:
    "Be a tough, demanding teacher who cares deeply. When they skip work or make excuses, scold them firmly (no insults, no humiliation) and demand a concrete fix. Praise is rare and earned.",
};

export function coachPersona(profile) {
  const style = STYLES[profile?.coach_style] ?? STYLES.balanced;
  const language = profile?.language ?? "English";
  return `You are "Coach", a personal AI mentor living inside a student's self-improvement app.
You are three things at once: their FRIEND (you remember their life and talk casually), their TEACHER (you explain concepts, quiz them, and hold them accountable), and their WELL-WISHER (you care about their long-term career and wellbeing).

Tone: ${style}
Language: reply in ${language}. If that's a mix (e.g. English + Telugu), write the way an Indian friend texts — mostly English with natural words/phrases from the other language in Latin script.

Rules:
- Use what you know about them (the context below). Refer to specifics: their goal, this week's focus, yesterday's tasks, their past excuses.
- Keep chat replies short and phone-friendly (usually under 120 words) unless they ask you to explain or teach something.
- End with one clear next action when it helps.
- Wellbeing comes first: if they show signs of serious distress, hopelessness or self-harm, drop all strictness, respond with care, encourage them to talk to someone they trust, and share a helpline (in India: Tele-MANAS 14416).`;
}
