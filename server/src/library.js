// =============================================================
// library.js — THE SHARED CONTENT LIBRARY ("AI writes once, reuse forever")
// -------------------------------------------------------------
// Three caches, all stored in the database:
//   1. question_bank      level-test questions (built-in + AI-written)
//   2. roadmap_templates  12-week roadmaps by topic + level + hours
//   3. explanations       answers to "explain X" questions
// With one student this saves a little. With 1,000 students who share
// goals, most requests become free database reads.
// =============================================================
import { all, get, run, db } from "./db.js";
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
// Put the built-in questions into the database once (safe to run every start)
export function seedQuestionBank() {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO question_bank (topic, question, options, correct_index, difficulty, source)
     VALUES (?, ?, ?, ?, ?, 'builtin')`,
  );
  // One transaction for all inserts: one disk write instead of 56 (much faster)
  db.exec("BEGIN");
  try {
    for (const [topic, levels] of Object.entries(BUILTIN_QUESTIONS)) {
      for (const [difficulty, questions] of Object.entries(levels)) {
        for (const [q, options, correct] of questions) insert.run(topic, q, JSON.stringify(options), correct, difficulty);
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
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
  const options = JSON.parse(row.options);
  const order = shuffle(options.map((_, i) => i));
  return {
    question: row.question,
    options: order.map((i) => options[i]),
    correct_index: order.indexOf(row.correct_index),
    topic: row.topic.replace(/^custom:/, ""),
  };
}

// 5 questions: 2 easy, 2 medium, 1 hard, spread across the topics
export function pickQuestions(topics, count = 5) {
  const want = { easy: 2, medium: 2, hard: 1 };
  const picked = [];
  for (const [difficulty, n] of Object.entries(want)) {
    const placeholders = topics.map(() => "?").join(",");
    const rows = all(
      `SELECT * FROM question_bank WHERE topic IN (${placeholders}) AND difficulty = ? ORDER BY RANDOM() LIMIT ?`,
      ...topics, difficulty, n,
    );
    picked.push(...rows);
  }
  // Not enough of one difficulty? Top up with any level.
  if (picked.length < count) {
    const have = new Set(picked.map((r) => r.id));
    const extra = all(
      `SELECT * FROM question_bank WHERE topic IN (${topics.map(() => "?").join(",")}) ORDER BY RANDOM()`,
      ...topics,
    ).filter((r) => !have.has(r.id));
    picked.push(...extra.slice(0, count - picked.length));
  }
  return picked.slice(0, count).map(serve);
}

export function saveQuestions(topic, questions) {
  const difficulties = ["easy", "easy", "medium", "medium", "hard"];
  questions.forEach((q, i) =>
    run(
      `INSERT OR IGNORE INTO question_bank (topic, question, options, correct_index, difficulty, source)
       VALUES (?, ?, ?, ?, ?, 'ai')`,
      topic, q.question, JSON.stringify(q.options), q.correct_index, difficulties[i] ?? "medium",
    ),
  );
}

// ---- 2. Roadmap templates ----------------------------------------------------
export const roadmapKey = (learn, level, hours) => `${topicKeyFor(learn)}|${level}|${hours}`;

export function findRoadmap(key) {
  const row = get("SELECT roadmap FROM roadmap_templates WHERE key = ?", key);
  if (!row) return null;
  run("UPDATE roadmap_templates SET uses = uses + 1 WHERE key = ?", key);
  return JSON.parse(row.roadmap);
}

export function saveRoadmap(key, roadmap) {
  run("INSERT OR REPLACE INTO roadmap_templates (key, roadmap) VALUES (?, ?)", key, JSON.stringify(roadmap));
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

export function findExplanation(key) {
  const row = get("SELECT answer FROM explanations WHERE key = ?", key);
  if (!row) return null;
  run("UPDATE explanations SET hits = hits + 1 WHERE key = ?", key);
  return row.answer;
}

export function saveExplanation(key, question, answer) {
  run("INSERT OR REPLACE INTO explanations (key, question, answer) VALUES (?, ?, ?)", key, question, answer);
}

export function libraryStats() {
  return {
    questions: get("SELECT COUNT(*) AS n FROM question_bank").n,
    aiQuestions: get("SELECT COUNT(*) AS n FROM question_bank WHERE source = 'ai'").n,
    roadmaps: get("SELECT COUNT(*) AS n, COALESCE(SUM(uses), 0) AS uses FROM roadmap_templates"),
    explanations: get("SELECT COUNT(*) AS n, COALESCE(SUM(hits), 0) AS hits FROM explanations"),
  };
}
