// =============================================================
// library.js — THE SHARED CONTENT LIBRARY ("AI writes once, reuse forever")
// -------------------------------------------------------------
// Three caches, all stored in the database:
//   1. question_bank      level-test questions (built-in + AI-written)
//   2. roadmap_templates  12-week roadmaps by topic + level + hours
//   3. explanations       answers to "explain X" questions
// These tables are SHARED by all students: when the AI writes a
// level test or roadmap for one student, everyone with the same
// subject gets it free afterwards. With 1,000 students who share
// goals, most requests become free database reads.
// =============================================================
import { all, get, run, transaction } from "./db.js";
import { BUILTIN_QUESTIONS } from "./data/questionBank.js";

// ---- Topic detection ---------------------------------------------------------
// Keywords -> built-in topic. \b = "word boundary", so "java" doesn't match "javascript".
const TOPIC_PATTERNS = {
  dsa: /\b(dsa|data structures?|algorithms?|leetcode|competitive programming)\b/i,
  javascript: /\b(javascript|js|node(\.?js)?|typescript)\b/i,
  python: /\bpython\b/i,
  sql: /\b(sql|mysql|postgres(ql)?|databases?|dbms)\b/i,
  react: /\breact\b/i,
  java: /\bjava\b/i,
  aptitude: /\b(aptitude|quant(itative)?|reasoning|placements?|campus)\b/i,
};

export function detectTopics(text) {
  return Object.keys(TOPIC_PATTERNS).filter((t) => TOPIC_PATTERNS[t].test(text ?? ""));
}

// A stable key for any free-text subject: lowercase words, sorted
// "React & Node.js" and "node.js, react" -> the same key
export function normalizeKey(text) {
  const words = String(text ?? "").toLowerCase().match(/[a-z0-9+#]+/g) ?? [];
  return [...new Set(words)].sort().slice(0, 8).join(" ");
}

export function topicKeyFor(learn) {
  const topics = detectTopics(learn);
  return topics.length ? topics.sort().join("+") : "custom:" + normalizeKey(learn);
}

// ---- 1. Question bank --------------------------------------------------------
// Put the built-in questions into the database once (safe to run every start).
// One transaction for all inserts: one round-trip commit instead of 56.
export async function seedQuestionBank() {
  await transaction(async (q) => {
    for (const [topic, levels] of Object.entries(BUILTIN_QUESTIONS)) {
      for (const [difficulty, questions] of Object.entries(levels)) {
        for (const [question, options, correct] of questions) {
          await q(
            `INSERT INTO question_bank (topic, question, options, correct_index, difficulty, source)
             VALUES ($1, $2, $3, $4, $5, 'builtin') ON CONFLICT (topic, question) DO NOTHING`,
            topic, question, JSON.stringify(options), correct, difficulty,
          );
        }
      }
    }
  });
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Shuffle the options so the right answer isn't always in the same place
function serve(row) {
  const options = row.options; // jsonb comes back already parsed
  const order = shuffle(options.map((_, i) => i));
  return {
    question: row.question,
    options: order.map((i) => options[i]),
    correct_index: order.indexOf(row.correct_index),
    topic: row.topic.replace(/^custom:/, ""),
  };
}

// 5 questions: 2 easy, 2 medium, 1 hard, spread across the topics.
// "topic = ANY($1)" means "topic is one of the values in this array".
export async function pickQuestions(topics, count = 5) {
  const want = { easy: 2, medium: 2, hard: 1 };
  const picked = [];
  for (const [difficulty, n] of Object.entries(want)) {
    picked.push(
      ...(await all(
        "SELECT * FROM question_bank WHERE topic = ANY($1) AND difficulty = $2 ORDER BY random() LIMIT $3",
        topics, difficulty, n,
      )),
    );
  }
  // Not enough of one difficulty? Top up with any level.
  if (picked.length < count) {
    const extra = await all(
      "SELECT * FROM question_bank WHERE topic = ANY($1) AND NOT (id = ANY($2)) ORDER BY random() LIMIT $3",
      topics, picked.map((r) => r.id), count - picked.length,
    );
    picked.push(...extra);
  }
  return picked.slice(0, count).map(serve);
}

export async function saveQuestions(topic, questions) {
  const difficulties = ["easy", "easy", "medium", "medium", "hard"];
  for (const [i, q] of questions.entries()) {
    await run(
      `INSERT INTO question_bank (topic, question, options, correct_index, difficulty, source)
       VALUES ($1, $2, $3, $4, $5, 'ai') ON CONFLICT (topic, question) DO NOTHING`,
      topic, q.question, JSON.stringify(q.options), q.correct_index, difficulties[i] ?? "medium",
    );
  }
}

// ---- 2. Roadmap templates ----------------------------------------------------
export const roadmapKey = (learn, level, hours) => `${topicKeyFor(learn)}|${level}|${hours}`;

export async function findRoadmap(key) {
  // UPDATE … RETURNING: bump the counter and read the row in one query
  const row = await get("UPDATE roadmap_templates SET uses = uses + 1 WHERE key = $1 RETURNING roadmap", key);
  return row?.roadmap ?? null;
}

export async function saveRoadmap(key, roadmap) {
  await run(
    `INSERT INTO roadmap_templates (key, roadmap) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET roadmap = excluded.roadmap`,
    key, JSON.stringify(roadmap),
  );
}

// ---- 3. Saved explanations ---------------------------------------------------
// Only general knowledge questions are cached ("explain recursion"),
// never personal ones ("why do I keep procrastinating?").
const EXPLAIN = /^(explain|what is|what are|what's|define|how does|how do|teach me|tell me about|difference between)\b/i;
const PERSONAL = /\b(i|i'm|im|me|my|mine|myself)\b/i;

export function isCacheableQuestion(text) {
  return text.length <= 140 && EXPLAIN.test(text.trim()) && !PERSONAL.test(text);
}

export const explanationKey = (text, language) => `${language}|${normalizeKey(text)}`;

export async function findExplanation(key) {
  const row = await get("UPDATE explanations SET hits = hits + 1 WHERE key = $1 RETURNING answer", key);
  return row?.answer ?? null;
}

export async function saveExplanation(key, question, answer) {
  await run(
    `INSERT INTO explanations (key, question, answer) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET answer = excluded.answer`,
    key, question, answer,
  );
}

export async function libraryStats() {
  const [q, ai, roadmaps, explanations] = await Promise.all([
    get("SELECT COUNT(*) AS n FROM question_bank"),
    get("SELECT COUNT(*) AS n FROM question_bank WHERE source = 'ai'"),
    get("SELECT COUNT(*) AS n, COALESCE(SUM(uses), 0) AS uses FROM roadmap_templates"),
    get("SELECT COUNT(*) AS n, COALESCE(SUM(hits), 0) AS hits FROM explanations"),
  ]);
  return { questions: q.n, aiQuestions: ai.n, roadmaps, explanations };
}
