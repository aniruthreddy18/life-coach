// =============================================================
// providers/openai.js — talks to OpenAI's API (GPT models)
// Turn on with AI_PROVIDER=openai in server/.env
// Key: https://platform.openai.com/api-keys
//
// Same two tiers as the other providers:
//   smart -> gpt-6-luna  : level test, assessment + roadmap, weekly report
//            (for better roadmaps, set OPENAI_MODEL_SMART=gpt-6.1-sol)
//   fast  -> gpt-6-luna  : daily tasks, check-ins, chat (cheapest)
// Run `npm run models` to see every model your key can use.
// =============================================================
import OpenAI from "openai";

export const MODELS = {
  smart: process.env.OPENAI_MODEL_SMART || "gpt-6-luna",
  fast: process.env.OPENAI_MODEL_FAST || "gpt-6-luna",
};

const appError = (status, message) => Object.assign(new Error(message), { status });

let client;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw appError(500, "No OpenAI API key found. Add OPENAI_API_KEY to server/.env and restart the server.");
  }
  client ??= new OpenAI(); // reads OPENAI_API_KEY itself
  return client;
}

// Turn SDK errors into short messages a user can act on
function friendly(err, model) {
  if (!(err instanceof OpenAI.APIError)) return err;
  if (err instanceof OpenAI.AuthenticationError) {
    return appError(500, "Your OpenAI API key is invalid. Check OPENAI_API_KEY in server/.env.");
  }
  if (err.code === "insufficient_quota") {
    return appError(402, "Your OpenAI account has no credits left. Add billing at platform.openai.com.");
  }
  if (err instanceof OpenAI.RateLimitError) {
    return appError(429, "OpenAI is busy (rate limit). Wait a minute and try again.");
  }
  if (err instanceof OpenAI.NotFoundError) {
    return appError(500, `OpenAI model "${model}" isn't available to your key. Run \`npm run models\` and set OPENAI_MODEL_SMART / OPENAI_MODEL_FAST in server/.env.`);
  }
  return appError(502, `OpenAI API error: ${err.message}`);
}

// We use OpenAI's "Responses API": instructions = system prompt, input = the conversation.
export async function askJSON({ system, prompt, schema, tier }) {
  const model = MODELS[tier];
  try {
    const response = await getClient().responses.create({
      model,
      instructions: system,
      input: prompt,
      // strict: true -> the reply is GUARANTEED to match our JSON Schema
      text: { format: { type: "json_schema", name: "result", schema, strict: true } },
    });
    if (response.status === "incomplete") throw appError(502, "The AI's answer was cut off. Try again.");
    if (!response.output_text) throw appError(422, "The AI declined to answer that request.");
    return JSON.parse(response.output_text);
  } catch (err) {
    throw friendly(err, model);
  }
}

export async function streamText({ system, messages, onText, tier }) {
  const model = MODELS[tier];
  try {
    const stream = getClient().responses.stream({
      model,
      instructions: system,
      input: messages.map(({ role, content }) => ({ role, content })),
    });
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") onText(event.delta);
    }
    const response = await stream.finalResponse();
    return response.output_text;
  } catch (err) {
    throw friendly(err, model);
  }
}

export async function listModels() {
  const models = [];
  for await (const m of getClient().models.list()) {
    if (/^(gpt|o\d)/.test(m.id)) models.push(m.id);
  }
  return models.sort();
}
