// =============================================================
// providers/openrouter.js — talks to OpenRouter
// Turn on with AI_PROVIDER=openrouter in server/.env
// Key: https://openrouter.ai/keys
//
// OpenRouter is ONE API key that reaches many AI companies' models.
// Its API copies OpenAI's "chat completions" format, so we reuse the
// official OpenAI library and just point it at OpenRouter's URL.
//
//   smart -> openai/gpt-6-sol  : level test, assessment + roadmap, weekly report
//   fast  -> openai/gpt-6-luna : daily tasks, check-ins, chat (cheapest)
//   free  -> optional (OPENROUTER_MODEL_FREE, e.g. a ":free" model): used
//            when today's budget is used up, instead of switching to rules
// Run `npm run models` to see the exact model names.
//
// Every function returns the AI's answer AND its token usage, so
// usage.js can track cost. OpenRouter also tells us the exact cost.
// =============================================================
import OpenAI from "openai";

export const MODELS = {
  smart: process.env.OPENROUTER_MODEL_SMART || "openai/gpt-6-sol",
  fast: process.env.OPENROUTER_MODEL_FAST || "openai/gpt-6-luna",
  free: process.env.OPENROUTER_MODEL_FREE || "",
};

// OpenRouter's usage object -> our simple { input, output, cost } shape
const usageOf = (u) => ({ input: u?.prompt_tokens ?? 0, output: u?.completion_tokens ?? 0, cost: u?.cost ?? null });

const appError = (status, message) => Object.assign(new Error(message), { status });

let client;
function getClient() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw appError(500, "No OpenRouter API key found. Add OPENROUTER_API_KEY to server/.env and restart the server.");
  }
  client ??= new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    // Optional: shows your app's name in the OpenRouter dashboard
    defaultHeaders: { "X-Title": "Life Coach" },
  });
  return client;
}

// Turn API errors into short messages a user can act on
function friendly(err, model) {
  if (!(err instanceof OpenAI.APIError)) return err;
  if (err.status === 401) return appError(500, "Your OpenRouter API key is invalid. Check OPENROUTER_API_KEY in server/.env.");
  if (err.status === 402) return appError(402, "Your OpenRouter account is out of credits. Add credits at openrouter.ai/credits.");
  if (err.status === 429) return appError(429, "Rate limit reached on OpenRouter. Wait a minute and try again.");
  if (err.status === 400 || err.status === 404) {
    return appError(500, `OpenRouter couldn't use model "${model}" (${err.message}). Run \`npm run models\` and check OPENROUTER_MODEL_SMART / OPENROUTER_MODEL_FAST in server/.env.`);
  }
  return appError(502, `OpenRouter error: ${err.message}`);
}

export async function askJSON({ system, prompt, schema, tier }) {
  const model = MODELS[tier];
  try {
    const completion = await getClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      // strict: true -> the reply must match our JSON Schema exactly
      response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema } },
      // OpenRouter-specific: only send this to providers that honour response_format
      provider: { require_parameters: true },
      usage: { include: true }, // ask OpenRouter to report the exact cost
    });
    const choice = completion.choices[0];
    if (choice?.finish_reason === "length") throw appError(502, "The AI's answer was cut off. Try again.");
    if (!choice?.message?.content) throw appError(422, "The AI declined to answer that request.");
    return { data: JSON.parse(choice.message.content), usage: usageOf(completion.usage) };
  } catch (err) {
    throw friendly(err, model);
  }
}

export async function streamText({ system, messages, onText, tier }) {
  const model = MODELS[tier];
  try {
    const stream = await getClient().chat.completions.create({
      model,
      messages: [{ role: "system", content: system }, ...messages.map(({ role, content }) => ({ role, content }))],
      stream: true,
      stream_options: { include_usage: true }, // last chunk carries token usage
      usage: { include: true },
    });
    let full = "";
    let usage = null;
    for await (const chunk of stream) {
      // OpenRouter reports errors that happen mid-stream inside a chunk
      if (chunk.error) throw appError(502, `OpenRouter error: ${chunk.error.message}`);
      if (chunk.usage) usage = chunk.usage;
      const piece = chunk.choices[0]?.delta?.content;
      if (piece) {
        full += piece;
        onText(piece);
      }
    }
    return { text: full, usage: usageOf(usage) };
  } catch (err) {
    throw friendly(err, model);
  }
}

// OpenRouter lists hundreds of models; we show OpenAI's GPT ones
// plus the free ones (for OPENROUTER_MODEL_FREE)
export async function listModels() {
  const models = [];
  for await (const m of getClient().models.list()) {
    if (m.id.startsWith("openai/gpt") || m.id.endsWith(":free")) models.push(m.id);
  }
  return models.sort();
}
