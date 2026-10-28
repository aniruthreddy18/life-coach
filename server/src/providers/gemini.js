// =============================================================
// providers/gemini.js — talks to Google's Gemini API
// Turn on with AI_PROVIDER=gemini in server/.env
// Free API key: https://aistudio.google.com/apikey
//
// Same two tiers as Claude. By default both use "gemini-flash-latest",
// Google's alias for its newest Flash model, which has a free tier.
// (Pro models need billing turned on.)
// Run `npm run models` to see every model your key can use.
// =============================================================
import { GoogleGenAI, ApiError } from "@google/genai";

export const MODELS = {
  smart: process.env.GEMINI_MODEL_SMART || "gemini-flash-latest",
  fast: process.env.GEMINI_MODEL_FAST || "gemini-flash-latest",
};

const appError = (status, message) => Object.assign(new Error(message), { status });
const usageOf = (u) => ({
  input: u?.promptTokenCount ?? 0,
  output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
  cost: null,
});

let client;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw appError(
      500,
      "No Gemini API key found. Get a free one at https://aistudio.google.com/apikey, add GEMINI_API_KEY to server/.env and restart the server.",
    );
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function friendly(err, model) {
  if (!(err instanceof ApiError)) return err;
  if (err.status === 400 || err.status === 401 || err.status === 403) {
    return appError(500, `Gemini rejected the request — check GEMINI_API_KEY in server/.env. (${err.message})`);
  }
  if (err.status === 404) {
    return appError(500, `Gemini model "${model}" not found. Run \`npm run models\` and set GEMINI_MODEL_SMART / GEMINI_MODEL_FAST in server/.env.`);
  }
  if (err.status === 429) {
    return appError(429, "Gemini free-tier limit reached. Wait a minute (or until tomorrow if it's the daily limit) and try again.");
  }
  return appError(502, `Gemini API error: ${err.message}`);
}

// Gemini calls the assistant "model" instead of "assistant"
const toGeminiContents = (messages) =>
  messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

// Our schemas say "additionalProperties: false" (Claude needs it).
// We drop that keyword for Gemini to keep the schema as simple as possible.
const forGemini = (schema) =>
  JSON.parse(JSON.stringify(schema, (key, value) => (key === "additionalProperties" ? undefined : value)));

export async function askJSON({ system, prompt, schema, tier }) {
  const model = MODELS[tier];
  try {
    const response = await getClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: forGemini(schema),
      },
    });
    const text = response.text;
    if (!text) throw appError(422, "Gemini returned an empty answer (it may have been blocked). Try again.");
    return { data: JSON.parse(text), usage: usageOf(response.usageMetadata) };
  } catch (err) {
    throw friendly(err, model);
  }
}

export async function streamText({ system, messages, onText, tier }) {
  const model = MODELS[tier];
  try {
    const stream = await getClient().models.generateContentStream({
      model,
      contents: toGeminiContents(messages),
      config: { systemInstruction: system },
    });
    let full = "";
    let usage = null;
    for await (const chunk of stream) {
      if (chunk.usageMetadata) usage = chunk.usageMetadata;
      const piece = chunk.text;
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

export async function listModels() {
  const models = [];
  const pager = await getClient().models.list();
  for await (const m of pager) {
    if (m.supportedActions?.includes("generateContent")) models.push(`${m.name.replace("models/", "")}  (${m.displayName})`);
  }
  return models;
}
