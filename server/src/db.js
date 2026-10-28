// =============================================================
// db.js — THE DATABASE LAYER
// -------------------------------------------------------------
// We use SQLite: a full SQL database that lives in ONE file
// (server/data/lifecoach.db). No installation needed — it's
// built into Node.js (node:sqlite).
//
// Everything you learn here (tables, SQL, keys, JOINs) works the
// same way in PostgreSQL/MySQL later.
// =============================================================
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "lifecoach.db"));

// Foreign keys make the DB refuse "orphan" rows,
// e.g. a task pointing at a milestone that doesn't exist.
db.exec("PRAGMA foreign_keys = ON;");

// -------------------------------------------------------------
// SCHEMA: the shape of our data. "IF NOT EXISTS" means this is
// safe to run every time the server starts.
// -------------------------------------------------------------
db.exec(`
  -- One row: who you are + what the AI concluded about you
  CREATE TABLE IF NOT EXISTS profile (
    id           INTEGER PRIMARY KEY CHECK (id = 1),  -- single-user app
    name         TEXT NOT NULL,
    answers      TEXT NOT NULL,      -- JSON: your onboarding answers
    quiz_score   INTEGER,            -- baseline test result (0-100)
    assessment   TEXT NOT NULL,      -- JSON: AI summary, scores, strengths...
    coach_style  TEXT NOT NULL,      -- gentle | balanced | strict
    language     TEXT NOT NULL,      -- English / English + Telugu / ...
    start_date   TEXT NOT NULL,      -- YYYY-MM-DD the roadmap begins
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- The roadmap: one row per week of your plan
  CREATE TABLE IF NOT EXISTS milestones (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number  INTEGER NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    focus        TEXT NOT NULL,
    goals        TEXT NOT NULL       -- JSON array of strings
  );

  -- Daily tasks. Many tasks belong to one milestone (one-to-many).
  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT NOT NULL,      -- YYYY-MM-DD
    title        TEXT NOT NULL,
    details      TEXT,
    minutes      INTEGER NOT NULL DEFAULT 30,
    milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    done         INTEGER NOT NULL DEFAULT 0,   -- SQLite has no boolean: 0/1
    done_at      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);

  -- One evening check-in per day (UNIQUE stops duplicates)
  CREATE TABLE IF NOT EXISTS checkins (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT NOT NULL UNIQUE,
    mood         INTEGER NOT NULL,   -- 1-10
    energy       INTEGER NOT NULL,   -- 1-10
    wins         TEXT,
    blockers     TEXT,
    coach_reply  TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Chat history with your coach
  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content      TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Long-term memory: facts the coach learned about you
  CREATE TABLE IF NOT EXISTS memories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fact         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Weekly reports written by the AI
  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start   TEXT NOT NULL,
    content      TEXT NOT NULL,      -- JSON from the AI
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Browsers/phones that agreed to receive notifications
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint     TEXT NOT NULL UNIQUE,
    subscription TEXT NOT NULL       -- JSON from the browser
  );

  -- Simple key/value store for app settings (e.g. push keys)
  CREATE TABLE IF NOT EXISTS settings (
    key          TEXT PRIMARY KEY,
    value        TEXT NOT NULL
  );

  -- ===== COST CONTROL =====
  -- One row per AI call: what it was for, which model, how many tokens, cost
  CREATE TABLE IF NOT EXISTS ai_usage (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    day           TEXT NOT NULL,           -- YYYY-MM-DD
    feature       TEXT NOT NULL,           -- quiz, roadmap, tasks, chat...
    model         TEXT NOT NULL,
    input_tokens  INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd      REAL NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON ai_usage(day);

  -- ===== SHARED CONTENT LIBRARY (AI writes once, everyone reuses) =====
  -- Level-test questions: built-in ones + ones the AI wrote earlier
  CREATE TABLE IF NOT EXISTS question_bank (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    topic         TEXT NOT NULL,           -- "dsa", "sql", or "custom:..." key
    question      TEXT NOT NULL,
    options       TEXT NOT NULL,           -- JSON array of 4 strings
    correct_index INTEGER NOT NULL,
    difficulty    TEXT NOT NULL,           -- easy | medium | hard
    source        TEXT NOT NULL,           -- builtin | ai
    UNIQUE (topic, question)
  );

  -- Roadmaps saved by (topic + level + hours) so the next student with
  -- the same goal gets one instantly, for free
  CREATE TABLE IF NOT EXISTS roadmap_templates (
    key           TEXT PRIMARY KEY,
    roadmap       TEXT NOT NULL,           -- JSON array of 12 weeks
    uses          INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Saved answers to "explain X" questions
  CREATE TABLE IF NOT EXISTS explanations (
    key           TEXT PRIMARY KEY,        -- normalized question + language
    question      TEXT NOT NULL,
    answer        TEXT NOT NULL,
    hits          INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// MIGRATION: databases created by older versions don't have this column yet.
// "carried" = 1 when an unfinished task was already copied to the next day.
try {
  db.exec("ALTER TABLE tasks ADD COLUMN carried INTEGER NOT NULL DEFAULT 0");
} catch {
  // column already exists — nothing to do
}

// -------------------------------------------------------------
// Small helpers so the rest of the code reads nicely.
// The "?" placeholders are IMPORTANT: values are passed separately,
// so a user typing  '); DROP TABLE tasks; --  can't break the query.
// This is how you prevent SQL injection.
// -------------------------------------------------------------
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export function getSetting(key) {
  return get("SELECT value FROM settings WHERE key = ?", key)?.value;
}
export function setSetting(key, value) {
  run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

// Dates as "YYYY-MM-DD" in YOUR local time zone
export function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
