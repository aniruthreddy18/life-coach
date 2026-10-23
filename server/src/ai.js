// =============================================================
// ai.js — TALKING TO CLAUDE
// -------------------------------------------------------------
// An LLM API is just an HTTP API: we send text (+ instructions),
// it sends text back. The official SDK (@anthropic-ai/sdk) wraps
// the HTTP calls for us.
//
// Two patterns live here:
//   1. askJSON()    -> we need DATA back (scores, a plan, tasks).
//                      We give Claude a JSON Schema and it MUST
//                      reply in exactly that shape ("structured output").
//   2. streamText() -> we need a chat reply, shown word-by-word.
// =============================================================
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// If Claude's safety filter ever declines a (harmless) request, the
// "fallbacks" option lets Anthropic retry it on another model instead
// of failing. Set CLAUDE_FALLBACKS=off in .env to disable.
const FALLBACK_OPTIONS =
  process.env.CLAUDE_FALLBACKS === "off"
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      "No Claude API key found. Add ANTHROPIC_API_KEY to server/.env and restart the server.",
    );
    err.status = 500;
    throw err;
  }
  // Create the client once and reuse it (it reads ANTHROPIC_API_KEY itself)
  client ??= new Anthropic();
  return client;
}

function checkStop(message) {
  if (message.stop_reason === "refusal") {
    const err = new Error("The AI declined to answer that request.");
    err.status = 422;
    throw err;
  }
}

function textOf(message) {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// ---- Pattern 1: structured JSON output ---------------------------------
export async function askJSON({ system, prompt, schema, effort = "low" }) {
  const message = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort, format: { type: "json_schema", schema } },
    ...FALLBACK_OPTIONS,
  });
  checkStop(message);
  if (message.stop_reason === "max_tokens") {
    throw new Error("AI response was cut off (max_tokens). Try again.");
  }
  return JSON.parse(textOf(message));
}

// ---- Pattern 2: streaming chat ------------------------------------------
// onText is called with each small piece of text as it arrives.
export async function streamText({ system, messages, onText, effort = "low" }) {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages,
    output_config: { effort },
    ...FALLBACK_OPTIONS,
  });
  stream.on("text", onText);
  const message = await stream.finalMessage();
  checkStop(message);
  return textOf(message);
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
