// =============================================================
// ai.js — THE ONE DOOR TO THE AI
// -------------------------------------------------------------
// The rest of the app only ever calls askJSON() and streamText()
// from this file. WHICH AI company answers is decided here, from
// AI_PROVIDER in server/.env:
//
//   AI_PROVIDER=openai  -> providers/openai.js  (GPT: Sol + Luna)
//   AI_PROVIDER=gemini  -> providers/gemini.js  (free tier)
//   AI_PROVIDER=claude  -> providers/claude.js  (Opus + Haiku)
//
// Switching providers = changing ONE line in .env. That's the payoff
// of keeping all AI code behind one small "interface".
//
// Two patterns:
//   1. askJSON()    -> we need DATA back (scores, a plan, tasks).
//                      We give the AI a JSON Schema and it MUST reply
//                      in exactly that shape ("structured output").
//   2. streamText() -> we need a chat reply, shown word-by-word.
//
// tier: "smart" for one-time/weekly jobs, "fast" for everyday jobs.
// =============================================================
import * as openai from "./providers/openai.js";
import * as gemini from "./providers/gemini.js";
import * as claude from "./providers/claude.js";

const PROVIDERS = { openai, gemini, claude };
export const PROVIDER_NAME = (process.env.AI_PROVIDER || "openai").toLowerCase();
const provider = PROVIDERS[PROVIDER_NAME];
if (!provider) {
  throw new Error(`Unknown AI_PROVIDER "${PROVIDER_NAME}" in server/.env. Use "openai", "gemini" or "claude".`);
}
export const MODELS = provider.MODELS;
export const listModels = provider.listModels;

export function askJSON({ system, prompt, schema, tier = "fast", effort = "low" }) {
  return provider.askJSON({ system, prompt, schema, tier, effort });
}

// onText is called with each small piece of text as it arrives.
export function streamText({ system, messages, onText, tier = "fast", effort = "low" }) {
  return provider.streamText({ system, messages, onText, tier, effort });
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
