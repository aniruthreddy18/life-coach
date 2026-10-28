// =============================================================
// doctor.js — "is everything set up correctly?"
// Run from the server folder:  npm run doctor
//
// Checks, one by one, and tells you exactly what to fix:
//   1. server/.env exists and has the right values
//   2. your AI key works (OpenRouter: key valid, credits left,
//      models exist, a real test call for "smart" and "fast")
//   3. Supabase sign-in is reachable (URL + publishable key)
//   4. the database connects and all the tables exist
// Nothing here costs more than a fraction of a cent.
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(serverDir, ".env");

let failed = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
const bad = (msg, fix) => {
  failed++;
  console.log(`  ❌ ${msg}${fix ? `\n     → ${fix}` : ""}`);
};
const section = (title) => console.log(`\n${title}`);

// fetch() with a time limit, so a dead network doesn't hang forever
async function getJSON(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body };
}

// ---- 1. The .env file -------------------------------------------------------
section("1. server/.env");
if (!fs.existsSync(envPath)) {
  const nearby = fs.readdirSync(serverDir).filter((f) => /^\.?env/i.test(f) && f !== ".env.example");
  const parentEnv = fs.existsSync(path.join(serverDir, "..", ".env"));
  bad(
    "No server/.env file.",
    nearby.length
      ? `Found ${nearby.join(", ")} — rename it to exactly ".env" (on Mac: mv "${nearby[0]}" .env).`
      : parentEnv
        ? "There's a .env in the life-coach folder — move it INTO the server folder."
        : "Run: cp .env.example .env  — then open .env and fill it in.",
  );
  console.log("\nFix that first, then run npm run doctor again.\n");
  process.exit(1);
}
process.loadEnvFile(envPath);
ok("found");

// Spot the usual copy-paste mistakes in a value
function checkValue(name, { required = true } = {}) {
  const v = process.env[name] ?? "";
  if (!v) {
    if (required) bad(`${name} is empty.`, `Add it to server/.env (see .env.example).`);
    return "";
  }
  if (v !== v.trim()) bad(`${name} has spaces at the start or end.`, "Remove them.");
  if (/^["'].*["']$/.test(v.trim())) warn(`${name} is wrapped in quotes — usually fine, but remove them if something fails.`);
  if (/YOUR|\[|\]|<|>|xxxx|paste/i.test(v)) bad(`${name} still has a placeholder in it: "${v.slice(0, 40)}…"`, "Replace it with the real value.");
  return v.trim().replace(/^["']|["']$/g, "");
}

const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase();
if (!["openrouter", "openai", "gemini", "claude", "none"].includes(provider)) {
  bad(`AI_PROVIDER="${provider}" is not valid.`, "Use openrouter, openai, gemini, claude or none.");
}

// ---- 2. The AI ---------------------------------------------------------------
section(`2. AI (AI_PROVIDER=${provider})`);
const KEY_VARS = { openrouter: "OPENROUTER_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", claude: "ANTHROPIC_API_KEY" };

if (provider === "none") {
  warn("AI is off — the app runs on rules + templates only (free). Set AI_PROVIDER=openrouter to use AI.");
} else {
  const keyName = KEY_VARS[provider];
  const key = checkValue(keyName);
  let keyLooksRight = Boolean(key);

  if (provider === "openrouter" && key) {
    if (!key.startsWith("sk-or-")) {
      keyLooksRight = false;
      bad(
        `${keyName} doesn't look like an OpenRouter key (they start with "sk-or-").`,
        key.startsWith("sk-") ? "That looks like an OpenAI key. Put it in OPENAI_API_KEY, or get an OpenRouter key at openrouter.ai/keys." : "Create one at openrouter.ai/keys.",
      );
    }
    const base = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    try {
      const { status, body } = await getJSON(`${base}/key`, { Authorization: `Bearer ${key}` });
      if (status === 401 || status === 403) {
        keyLooksRight = false;
        bad("OpenRouter says this key is invalid.", "Copy it again from openrouter.ai/keys (the whole thing) into OPENROUTER_API_KEY.");
      } else if (status === 200) {
        const d = body?.data ?? {};
        ok(`key is valid${d.label ? ` ("${d.label}")` : ""}`);
        if (d.limit_remaining != null && d.limit_remaining <= 0) bad("This key's spending limit is used up.", "Raise the key's limit at openrouter.ai/keys.");
      } else {
        warn(`couldn't check the key (HTTP ${status}).`);
      }
      const credits = await getJSON(`${base}/credits`, { Authorization: `Bearer ${key}` });
      if (credits.status === 200 && credits.body?.data) {
        const left = credits.body.data.total_credits - credits.body.data.total_usage;
        if (left <= 0) bad(`No credits left ($${left.toFixed(4)}).`, "Add credits at openrouter.ai/credits (the app still works in rules mode without them).");
        else ok(`credits left: $${left.toFixed(2)}`);
      }
      const models = await getJSON(`${base}/models`);
      if (models.status === 200 && Array.isArray(models.body?.data)) {
        const ids = new Set(models.body.data.map((m) => m.id));
        for (const [tier, envName] of [["smart", "OPENROUTER_MODEL_SMART"], ["fast", "OPENROUTER_MODEL_FAST"], ["free", "OPENROUTER_MODEL_FREE"]]) {
          const id = process.env[envName] || { smart: "openai/gpt-6-sol", fast: "openai/gpt-6-luna" }[tier];
          if (!id) continue;
          if (ids.has(id)) ok(`${tier} model "${id}" exists`);
          else bad(`${tier} model "${id}" not found on OpenRouter.`, `Run "npm run models" and put a real model name in ${envName}.`);
        }
      }
    } catch (err) {
      keyLooksRight = false;
      bad(`Can't reach OpenRouter: ${err.cause?.code ?? err.message}`, "Check your internet connection (or VPN/firewall).");
    }
  }

  // A real (tiny) request through the same code the app uses
  if (keyLooksRight) {
    const p = await import(`../src/providers/${provider}.js`);
    const schema = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"], additionalProperties: false };
    for (const tier of ["fast", "smart"]) {
      try {
        const started = Date.now();
        const { data, usage } = await p.askJSON({
          system: "You are a test. Reply briefly.",
          prompt: 'Return {"reply": "ok"}.',
          schema,
          tier,
          effort: "low",
        });
        const cost = usage?.cost != null ? `, cost $${Number(usage.cost).toFixed(6)}` : "";
        ok(`test call with ${tier} model (${p.MODELS[tier]}) worked in ${((Date.now() - started) / 1000).toFixed(1)}s → "${data.reply}"${cost}`);
      } catch (err) {
        bad(`test call with ${tier} model (${p.MODELS[tier]}) failed: ${err.message}`);
      }
    }
    try {
      let text = "";
      await p.streamText({ system: "Reply in 3 words.", messages: [{ role: "user", content: "Say hi" }], onText: (t) => (text += t), tier: "fast", effort: "low" });
      ok(`chat streaming works → "${text.trim().slice(0, 40)}"`);
    } catch (err) {
      bad(`chat streaming failed: ${err.message}`);
    }
  }
}

// ---- 3. Supabase sign-in -------------------------------------------------------
section("3. Supabase sign-in (email OTP)");
const supabaseUrl = checkValue("SUPABASE_URL").replace(/\/$/, "");
const publishable = checkValue("SUPABASE_PUBLISHABLE_KEY");
if (supabaseUrl && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl)) {
  warn(`SUPABASE_URL "${supabaseUrl}" doesn't look like https://<project>.supabase.co`);
}
if (supabaseUrl && publishable) {
  try {
    const jwks = await getJSON(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
    if (jwks.status === 200) ok(`sign-in service reachable (${jwks.body?.keys?.length ?? 0} signing key(s))`);
    else bad(`sign-in service answered HTTP ${jwks.status}.`, "Check SUPABASE_URL. Is the project paused? Open the dashboard and restore it.");

    const settings = await getJSON(`${supabaseUrl}/auth/v1/settings`, { apikey: publishable });
    if (settings.status === 401) bad("SUPABASE_PUBLISHABLE_KEY was rejected.", "Copy it from Dashboard → Project Settings → API Keys.");
    else if (settings.status === 200) {
      if (settings.body?.external?.email === false) bad("Email sign-in is turned OFF.", "Dashboard → Authentication → Sign In / Providers → Email → enable.");
      else ok("email sign-in is enabled");
      if (settings.body?.disable_signup) warn("New sign-ups are disabled — only existing users can sign in.");
    }
  } catch (err) {
    bad(`Can't reach Supabase: ${err.cause?.code ?? err.message}`, "Check your internet connection.");
  }
}
console.log("     ℹ️  Can't be checked from here (do these once in the dashboard — see README):");
console.log("        • Authentication → Emails → Templates: \"Magic Link\" + \"Confirm signup\" show {{ .Token }}");
console.log("        • Authentication → Emails → SMTP Settings: your Gmail + app password (so friends get codes)");

// ---- 4. Database ------------------------------------------------------------------
section("4. Database (Supabase Postgres)");
const dbUrl = checkValue("DATABASE_URL");
if (dbUrl) {
  if (/db\.[a-z0-9]+\.supabase\.co/.test(dbUrl)) {
    warn("This is the DIRECT connection (IPv6 only — fails on many home Wi-Fi networks). If it fails, use the Session pooler URI instead.");
  }
  const { pool } = await import("../src/db.js");
  try {
    await pool.query("SELECT 1");
    ok("connected");
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const have = new Set(rows.map((r) => r.table_name));
    const need = ["profiles", "milestones", "tasks", "checkins", "messages", "memories", "reports", "push_subscriptions", "ai_usage", "question_bank", "roadmap_templates", "explanations", "app_settings"];
    const missing = need.filter((t) => !have.has(t));
    if (missing.length) bad(`missing tables: ${missing.join(", ")}`, "Run: npm run db:setup");
    else {
      ok(`all ${need.length} tables exist`);
      const users = await pool.query("SELECT COUNT(*) AS n FROM profiles");
      ok(`${users.rows[0].n} student(s) onboarded so far`);
    }
  } catch (err) {
    const fixes = {
      "28P01": "Wrong database password. Reset it: Dashboard → Project Settings → Database → Reset password, then update DATABASE_URL.",
      ENOTFOUND: 'Host not found. Copy the "Session pooler" URI again from the dashboard\'s Connect button.',
      ENETUNREACH: 'Your network has no IPv6. Use the "Session pooler" URI from the Connect button.',
      ETIMEDOUT: "Timed out. Check your internet, or the project may be paused (open the dashboard).",
      ECONNREFUSED: "Connection refused. Check the host/port in DATABASE_URL.",
      XX000: 'Supabase says "tenant/user not found": the username must be postgres.<project-ref> for the pooler. Copy the URI from the Connect button.',
    };
    const code = err.code ?? err.errors?.[0]?.code;
    bad(`can't connect: ${err.message || code}`, fixes[code] ?? (/Tenant or user not found/i.test(err.message) ? fixes.XX000 : "Double-check DATABASE_URL."));
  } finally {
    await pool.end();
  }
}

// ---- Result ------------------------------------------------------------------------
console.log(
  failed
    ? `\n❌ ${failed} problem(s) found. Fix the ❌ lines above, then run npm run doctor again.\n`
    : "\n🎉 All good! Start the app with: npm run dev (from the life-coach folder)\n",
);
process.exit(failed ? 1 : 0);
