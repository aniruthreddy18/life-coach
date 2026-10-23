// =============================================================
// env.js — loads secrets/settings from server/.env into process.env
// It must be the FIRST import in index.js, so every other file
// sees the values when it loads.
// Why a .env file? Secrets (like your API key) must never be
// written in code or pushed to GitHub. .gitignore excludes it.
// =============================================================
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");
try {
  process.loadEnvFile(envPath);
} catch {
  console.warn("⚠️  No server/.env file found — copy .env.example to .env and add your API key.");
}
