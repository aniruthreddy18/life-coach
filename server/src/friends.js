// =============================================================
// friends.js — STUDY BUDDIES: matching, requests, chat, safety
// -------------------------------------------------------------
// 1. MATCHING (free, no AI): we compare your onboarding answers with
//    everyone who turned on "Find study buddies" and score each person:
//      same subject (DSA, Java…)  up to 45
//      same level                 20 (next level: 10)
//      same goal (placements…)    15
//      similar daily time         10 (one step away: 5)
//      same language              10
//    and show WHY ("Both DSA · Intermediate · 2–3 hours").
// 2. REQUESTS: send → the other person accepts → you're friends.
//    (If they had already sent YOU one, sending back = instant accept.)
// 3. CHAT: simple messages, the browser asks for new ones every few
//    seconds ("polling"). Pokes send a funny push notification.
// 4. SAFETY: we never show emails. Block hides you both ways and ends
//    the friendship; Report saves a note for the app owner.
// Every function takes uid (the signed-in student) and checks that
// they're allowed to see/change what they ask for.
// =============================================================
import { all, get, run, today } from "./db.js";
import { getProfile, getStreak } from "./state.js";
import { detectTopics, normalizeKey } from "./library.js";
import { notifyUser } from "./push.js";
import { pokeNote } from "./messages.js";

// An error with an HTTP status, so routes can just `throw` it
export const fail = (status, message) => Object.assign(new Error(message), { status });
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v ?? ""));

const TOPIC_NAMES = {
  dsa: "DSA", javascript: "JavaScript", python: "Python", sql: "SQL", react: "React", java: "Java", aptitude: "Aptitude",
};
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const HOURS = ["Less than 1 hour", "1–2 hours", "2–3 hours", "3–5 hours", "5+ hours"];
const GOALS = {
  placements: /\b(placements?|campus|job|offer|sde|software (developer|engineer)|product based|mnc)\b/i,
  internship: /\binternships?\b/i,
  gate: /\bgate\b/i,
  "higher studies": /\b(gre|ielts|toefl|ms|masters|higher stud(y|ies)|abroad)\b/i,
  "competitive programming": /\b(competitive|codeforces|codechef|icpc|contests?)\b/i,
  projects: /\b(projects?|portfolio|build|startup|freelanc\w*)\b/i,
  "government exams": /\b(upsc|ssc|bank|psu|government|govt)\b/i,
};

// The subjects someone studies, as keys: ["dsa", "java"] or ["custom:machine learning"]
export function topicsOf(profile) {
  const learn = profile?.answers?.learn ?? "";
  const found = detectTopics(learn);
  return found.length ? found : ["custom:" + normalizeKey(learn)];
}
export const topicName = (key) => TOPIC_NAMES[key] ?? key.replace(/^custom:/, "");
// Built-in subjects by name; anything else in the person's own words
export const subjectsOf = (profile) => {
  const found = detectTopics(profile?.answers?.learn ?? "");
  return found.length ? found.map(topicName) : [String(profile?.answers?.learn ?? "").trim().slice(0, 40)];
};
const goalsOf = (profile) => Object.keys(GOALS).filter((g) => GOALS[g].test(profile?.answers?.goal ?? ""));
const levelOf = (profile) => profile?.assessment?.level ?? "Beginner";

// What other people can see about you. NEVER the email.
export function publicCard(profile) {
  return {
    id: profile.user_id,
    name: profile.name,
    goal: String(profile.answers?.goal ?? "").slice(0, 140),
    subjects: subjectsOf(profile),
    level: levelOf(profile),
    hours: profile.answers?.hours ?? "",
    language: profile.language,
  };
}

export function matchScore(me, them) {
  const reasons = [];
  let score = 0;

  const mine = new Set(topicsOf(me));
  const shared = topicsOf(them).filter((t) => mine.has(t));
  if (shared.length) {
    const union = new Set([...mine, ...topicsOf(them)]).size;
    score += Math.round(25 + 20 * (shared.length / union)); // 25–45
    reasons.push(`Both ${shared.some((t) => t.startsWith("custom:")) ? "study the same thing" : shared.map(topicName).join(" + ")}`);
  }

  const gap = Math.abs(LEVELS.indexOf(levelOf(me)) - LEVELS.indexOf(levelOf(them)));
  if (gap === 0) (score += 20), reasons.push(levelOf(me));
  else if (gap === 1) score += 10;

  const goals = goalsOf(them).filter((g) => goalsOf(me).includes(g));
  if (goals.length) (score += 15), reasons.push(`Goal: ${goals[0]}`);

  const hourGap = Math.abs(HOURS.indexOf(me.answers?.hours) - HOURS.indexOf(them.answers?.hours));
  if (hourGap === 0) (score += 10), reasons.push(`${me.answers.hours}/day`);
  else if (hourGap === 1) score += 5;

  if (me.language === them.language) (score += 10), me.language !== "English" && reasons.push(me.language);

  return { score: Math.min(score, 100), reasons };
}

// ---- Your own buddy settings ------------------------------------------------
export async function mySettings(uid) {
  const row = await get("SELECT friend_code, discoverable FROM profiles WHERE user_id = $1", uid);
  if (!row) throw fail(404, "Finish onboarding first.");
  return { friendCode: row.friend_code, discoverable: row.discoverable };
}

export async function setDiscoverable(uid, on) {
  await run("UPDATE profiles SET discoverable = $2 WHERE user_id = $1", uid, Boolean(on));
  return mySettings(uid);
}

// ---- 1. Find study buddies ---------------------------------------------------
// People you're blocked with / already connected to are left out.
export async function findMatches(uid) {
  const me = await getProfile(uid);
  if (!me) throw fail(404, "Finish onboarding first.");
  const candidates = await all(
    `SELECT p.* FROM profiles p
      WHERE p.discoverable AND p.user_id <> $1
        AND NOT EXISTS (SELECT 1 FROM blocks b
                         WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
                            OR (b.blocker_id = p.user_id AND b.blocked_id = $1))
        AND NOT EXISTS (SELECT 1 FROM friendships f
                         WHERE (f.requester_id = $1 AND f.addressee_id = p.user_id)
                            OR (f.requester_id = p.user_id AND f.addressee_id = $1))
      ORDER BY p.created_at DESC
      LIMIT 300`,
    uid,
  );
  return candidates
    .map((p) => ({ ...publicCard(p), ...matchScore(me, p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

// ---- 2. Requests -------------------------------------------------------------
const isBlocked = (a, b) =>
  get(
    `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    a, b,
  );
const pairRow = (a, b) =>
  get(
    `SELECT * FROM friendships
      WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    a, b,
  );

// Send to someone from your matches (userId) or by their friend code (code)
export async function sendRequest(uid, { userId, code }) {
  const me = await getProfile(uid);
  if (!me) throw fail(404, "Finish onboarding first.");
  if (!code && !isUuid(userId)) throw fail(404, "That person isn't available.");
  const target = code
    ? await get("SELECT * FROM profiles WHERE friend_code = $1", String(code).trim().toUpperCase())
    : await get("SELECT * FROM profiles WHERE user_id = $1 AND discoverable", userId);
  if (!target) throw fail(404, code ? "No one has that friend code. Check it and try again." : "That person isn't available.");
  if (target.user_id === uid) throw fail(400, "That's your own code 😄");
  if (await isBlocked(uid, target.user_id)) throw fail(404, "That person isn't available.");

  const existing = await pairRow(uid, target.user_id);
  if (existing?.status === "accepted") throw fail(409, `You and ${target.name} are already friends.`);
  if (existing && existing.requester_id === uid) throw fail(409, `Request already sent to ${target.name}.`);
  if (existing) return respond(uid, existing.id, true); // they asked you first -> accept

  const pending = await get("SELECT COUNT(*) AS n FROM friendships WHERE requester_id = $1 AND status = 'pending'", uid);
  if (pending.n >= 30) throw fail(429, "You have 30 requests waiting. Wait for some answers first.");

  const row = await get(
    "INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) RETURNING id",
    uid, target.user_id,
  );
  notifyUser(target.user_id, "New study buddy request 🤝", `${me.name} wants to be your study buddy`, "/friends").catch(() => {});
  return { status: "pending", friendshipId: row.id, name: target.name };
}

export async function listRequests(uid) {
  const rows = await all(
    `SELECT f.id AS friendship_id, f.requester_id, f.created_at, p.*
       FROM friendships f
       JOIN profiles p ON p.user_id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE f.status = 'pending' AND (f.requester_id = $1 OR f.addressee_id = $1)
      ORDER BY f.created_at DESC`,
    uid,
  );
  const me = await getProfile(uid);
  const card = (r) => ({ friendshipId: r.friendship_id, sentAt: r.created_at, ...publicCard(r), ...matchScore(me, r) });
  return {
    incoming: rows.filter((r) => r.requester_id !== uid).map(card),
    outgoing: rows.filter((r) => r.requester_id === uid).map(card),
  };
}

export async function respond(uid, friendshipId, accept) {
  const f = await get("SELECT * FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending'", friendshipId, uid);
  if (!f) throw fail(404, "That request isn't there any more.");
  if (!accept) {
    await run("DELETE FROM friendships WHERE id = $1", f.id);
    return { status: "declined" };
  }
  await run("UPDATE friendships SET status = 'accepted', accepted_at = now() WHERE id = $1", f.id);
  const me = await getProfile(uid);
  notifyUser(f.requester_id, "Request accepted 🎉", `${me.name} is now your study buddy. Today's duel is ready ⚔️`, `/friends/${f.id}`).catch(() => {});
  return { status: "accepted", friendshipId: f.id };
}

// Cancel your request, or unfriend
export async function removeFriendship(uid, friendshipId) {
  const result = await run(
    "DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)",
    friendshipId, uid,
  );
  if (!result.rowCount) throw fail(404, "Not found.");
}

// ---- 3. Friends list -----------------------------------------------------------
// One query gets each friend + last message + unread count + duel record.
export async function listFriends(uid) {
  const rows = await all(
    `SELECT f.id AS friendship_id, f.accepted_at, p.*,
            last.content AS last_message, last.created_at AS last_at, last.sender_id AS last_sender,
            (SELECT COUNT(*) FROM friend_messages m
              WHERE m.friendship_id = f.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread,
            (SELECT COUNT(*) FROM duels d WHERE d.friendship_id = f.id AND d.finalized AND d.winner_id = $1) AS wins,
            (SELECT COUNT(*) FROM duels d WHERE d.friendship_id = f.id AND d.finalized AND d.winner_id = p.user_id) AS losses,
            (SELECT e.submitted_at IS NOT NULL FROM duels d JOIN duel_entries e ON e.duel_id = d.id AND e.user_id = $1
              WHERE d.friendship_id = f.id AND d.date = $2) AS duel_done
       FROM friendships f
       JOIN profiles p ON p.user_id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       LEFT JOIN LATERAL (SELECT content, created_at, sender_id FROM friend_messages
                           WHERE friendship_id = f.id ORDER BY id DESC LIMIT 1) last ON true
      WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
      ORDER BY COALESCE(last.created_at, f.accepted_at) DESC`,
    uid, today(), // today() = the server's local date (CURRENT_DATE would be UTC on Supabase)
  );
  return Promise.all(
    rows.map(async (r) => ({
      friendshipId: r.friendship_id,
      ...publicCard(r),
      streak: await getStreak(r.user_id),
      lastMessage: r.last_message ? { text: r.last_message, at: r.last_at, mine: r.last_sender === uid } : null,
      unread: r.unread,
      record: { wins: r.wins, losses: r.losses },
      duelDone: Boolean(r.duel_done),
    })),
  );
}

// Requests waiting for you + unread messages (one number for the dock)
export async function badge(uid) {
  const row = await get(
    `SELECT (SELECT COUNT(*) FROM friendships WHERE addressee_id = $1 AND status = 'pending')
          + (SELECT COUNT(*) FROM friend_messages m JOIN friendships f ON f.id = m.friendship_id
              WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
                AND m.sender_id <> $1 AND m.read_at IS NULL) AS count`,
    uid,
  );
  return { count: row.count };
}

// The friendship, only if you're in it and it's accepted. Used by chat + duels.
export async function getFriendship(uid, friendshipId) {
  const f = await get(
    `SELECT * FROM friendships WHERE id = $1 AND status = 'accepted' AND (requester_id = $2 OR addressee_id = $2)`,
    Number(friendshipId), uid,
  );
  if (!f) throw fail(404, "You're not friends with this person (any more).");
  const friendId = f.requester_id === uid ? f.addressee_id : f.requester_id;
  return { ...f, friendId };
}

export async function friendInfo(uid, friendshipId) {
  const f = await getFriendship(uid, friendshipId);
  const [them, me] = await Promise.all([getProfile(f.friendId), getProfile(uid)]);
  return { friendshipId: f.id, since: f.accepted_at, friend: { ...publicCard(them), streak: await getStreak(f.friendId) }, match: matchScore(me, them) };
}

// ---- 4. Chat ---------------------------------------------------------------------
const MAX_LEN = 1000;
const recent = new Map(); // uid -> timestamps of recent messages (spam guard)
const lastPush = new Map(); // "friendship:sender" -> when we last pushed a message notification

export async function getMessages(uid, friendshipId, afterId = 0) {
  const f = await getFriendship(uid, friendshipId);
  const messages = await all(
    `SELECT id, sender_id = $2 AS mine, kind, content, created_at, read_at
       FROM friend_messages WHERE friendship_id = $1 AND id > $3 ORDER BY id DESC LIMIT 200`,
    f.id, uid, Number(afterId) || 0,
  );
  // Opening the chat = you've read their messages
  await run(
    "UPDATE friend_messages SET read_at = now() WHERE friendship_id = $1 AND sender_id <> $2 AND read_at IS NULL",
    f.id, uid,
  );
  return messages.reverse();
}

export async function sendMessage(uid, friendshipId, text) {
  const content = String(text ?? "").trim();
  if (!content) throw fail(400, "Type a message first.");
  if (content.length > MAX_LEN) throw fail(400, `Keep it under ${MAX_LEN} characters.`);
  const now = Date.now();
  const times = (recent.get(uid) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= 20) throw fail(429, "Slow down a little — max 20 messages a minute.");
  recent.set(uid, [...times, now]);

  const f = await getFriendship(uid, friendshipId);
  const msg = await get(
    `INSERT INTO friend_messages (friendship_id, sender_id, content) VALUES ($1, $2, $3)
     RETURNING id, true AS mine, kind, content, created_at, read_at`,
    f.id, uid, content,
  );
  // One notification per 10 minutes per chat, so a conversation doesn't buzz 50 times
  const key = `${f.id}:${uid}`;
  if (now - (lastPush.get(key) ?? 0) > 10 * 60_000) {
    lastPush.set(key, now);
    const me = await getProfile(uid);
    notifyUser(f.friendId, `💬 ${me.name}`, content.slice(0, 120), `/friends/${f.id}`).catch(() => {});
  }
  return msg;
}

// Poke: a funny nudge. Once an hour per friend.
const lastPoke = new Map();
export async function poke(uid, friendshipId) {
  const f = await getFriendship(uid, friendshipId);
  const key = `${f.id}:${uid}`;
  const wait = 60 * 60_000 - (Date.now() - (lastPoke.get(key) ?? 0));
  if (wait > 0) throw fail(429, `You can poke again in ${Math.ceil(wait / 60_000)} min 😄`);
  lastPoke.set(key, Date.now());
  const [me, them] = await Promise.all([getProfile(uid), getProfile(f.friendId)]);
  const line = pokeNote(them, me.name);
  const msg = await get(
    `INSERT INTO friend_messages (friendship_id, sender_id, kind, content) VALUES ($1, $2, 'poke', $3)
     RETURNING id, true AS mine, kind, content, created_at, read_at`,
    f.id, uid, `👉 Poked ${them.name}`,
  );
  notifyUser(f.friendId, "👉 Poke!", line, `/friends/${f.id}`).catch(() => {});
  return msg;
}

// ---- 5. Safety ---------------------------------------------------------------------
export async function block(uid, otherId) {
  if (!isUuid(otherId) || otherId === uid) throw fail(400, "Pick someone to block.");
  await run("INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", uid, otherId);
  await run(
    "DELETE FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)",
    uid, otherId,
  );
}

export async function report(uid, otherId, reason) {
  const text = String(reason ?? "").trim().slice(0, 1000);
  if (!isUuid(otherId) || !text) throw fail(400, "Tell us what happened.");
  await run("INSERT INTO user_reports (reporter_id, reported_id, reason) VALUES ($1, $2, $3)", uid, otherId, text);
}
