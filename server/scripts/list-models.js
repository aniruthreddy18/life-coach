// =============================================================
// list-models.js — "which AI models can my API key use?"
// Run from the life-coach folder:  npm run models
// Copy a model name into GEMINI_MODEL_SMART / GEMINI_MODEL_FAST
// (or CLAUDE_MODEL_SMART / CLAUDE_MODEL_FAST) in server/.env.
// =============================================================
import "../src/env.js";
import { PROVIDER_NAME, MODELS, listModels } from "../src/ai.js";

try {
  const models = await listModels();
  console.log(`\nModels available to your ${PROVIDER_NAME} key:\n`);
  for (const m of models) console.log("  " + m);
  console.log(`\nCurrently using -> smart: ${MODELS.smart}, fast: ${MODELS.fast}\n`);
} catch (err) {
  console.error("\n⚠️ ", err.message, "\n");
  process.exit(1);
}
