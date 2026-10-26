// =============================================================
// providers/claude.js — talks to Anthropic's Claude API
// Turn on with AI_PROVIDER=claude in server/.env
//
// Two "tiers" of model:
//   smart -> Opus: one-time / weekly jobs where quality matters most
//            (level test, assessment + roadmap, weekly report)
//   fast  -> Haiku: everyday jobs (tasks, check-ins, chat), ~40x cheaper
// =============================================================
import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  smart: process.env.CLAUDE_MODEL_SMART || "claude-opus-5-5",
  fast: process.env.CLAUDE_MODEL_FAST || "claude-haiku-5-5",
};

// If Claude's safety filter ever declines a (harmless) request, "fallbacks"
// lets Anthropic retry it on another model instead of failing. Only some
// models support it (not Haiku). Set CLAUDE_FALLBACKS=off to disable.
const FALLBACK_MODELS = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/;
function fallbackOptions(model) {
  if (process.env.CLAUDE_FALLBACKS === "off" || !FALLBACK_MODELS.test(model)) return {};
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

const appError = (status, message) => Object.assign(new Error(message), { status });

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw appError(500, "No Claude API key found. Add ANTHROPIC_API_KEY to server/.env and restart the server.");
  }
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY itself
  return client;
}

// Turn SDK errors into short messages a user can act on
function friendly(err) {
  if (err.status && !(err instanceof Anthropic.APIError)) return err; // already friendly
  if (err instanceof Anthropic.AuthenticationError) {
    return appError(500, "Your Claude API key is invalid. Check ANTHROPIC_API_KEY in server/.env.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return appError(429, "Claude is busy (rate limit). Wait a minute and try again.");
  }
  if (err instanceof Anthropic.APIError) {
    return appError(502, `Claude API error: ${err.message}`);
  }
  return err;
}

function checkStop(message) {
  if (message.stop_reason === "refusal") throw appError(422, "The AI declined to answer that request.");
  if (message.stop_reason === "max_tokens") throw appError(502, "The AI's answer was cut off. Try again.");
}

const textOf = (message) =>
  message.content.filter((b) => b.type === "text").map((b) => b.text).join("");

export async function askJSON({ system, prompt, schema, tier, effort }) {
  const model = MODELS[tier];
  try {
    const message = await getClient().beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort, format: { type: "json_schema", schema } },
      ...fallbackOptions(model),
    });
    checkStop(message);
    return JSON.parse(textOf(message));
  } catch (err) {
    throw friendly(err);
  }
}

export async function streamText({ system, messages, onText, tier, effort }) {
  const model = MODELS[tier];
  try {
    const stream = getClient().beta.messages.stream({
      model,
      max_tokens: 16000,
      system,
      messages,
      output_config: { effort },
      ...fallbackOptions(model),
    });
    stream.on("text", onText);
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw appError(422, "The AI declined to answer that request.");
    return textOf(message);
  } catch (err) {
    throw friendly(err);
  }
}

export async function listModels() {
  const models = [];
  for await (const m of getClient().models.list()) models.push(`${m.id}  (${m.display_name})`);
  return models;
}
