// =============================================================
// routes/friends.js — STUDY BUDDIES API
//   GET    /api/friends                    -> your friends + request counts + your code
//   PATCH  /api/friends/settings           -> { discoverable: true/false }
//   GET    /api/friends/badge             -> { count } for the dock's red dot
//   GET    /api/friends/matches            -> suggested study buddies (match %)
//   GET    /api/friends/requests           -> incoming + outgoing requests
//   POST   /api/friends/requests           -> { userId } or { code }
//   POST   /api/friends/requests/:id/accept | /decline
//   POST   /api/friends/block              -> { userId }
//   POST   /api/friends/report             -> { userId, reason }
//   GET    /api/friends/:id                -> one friend + rivalry record
//   DELETE /api/friends/:id                -> unfriend / cancel request
//   GET    /api/friends/:id/messages?after=ID   POST /api/friends/:id/messages { text }
//   POST   /api/friends/:id/poke
//   GET    /api/friends/:id/duel           POST /api/friends/:id/duel   { answers: [0,2,…] }
//   GET    /api/friends/:id/weekly         POST /api/friends/:id/weekly { answers }
// Static paths (matches, requests…) come BEFORE "/:id", otherwise
// Express would treat "matches" as an id.
// =============================================================
import { Router } from "express";
import * as friends from "../friends.js";
import * as duels from "../duels.js";

export const router = Router();
const uid = (req) => req.user.id;
const id = (req) => {
  const n = Number(req.params.id);
  if (!Number.isInteger(n) || n <= 0) throw friends.fail(400, "Invalid id");
  return n;
};

router.get("/friends", async (req, res) => {
  const [list, requests, settings] = await Promise.all([
    friends.listFriends(uid(req)),
    friends.listRequests(uid(req)),
    friends.mySettings(uid(req)),
  ]);
  res.json({ friends: list, incoming: requests.incoming.length, outgoing: requests.outgoing.length, ...settings });
});

router.patch("/friends/settings", async (req, res) => {
  if (typeof req.body.discoverable !== "boolean") return res.status(400).json({ error: "discoverable must be true or false" });
  res.json(await friends.setDiscoverable(uid(req), req.body.discoverable));
});

// Tiny call for the red dot on the Friends tab
router.get("/friends/badge", async (req, res) => res.json(await friends.badge(uid(req))));
router.get("/friends/matches", async (req, res) => res.json(await friends.findMatches(uid(req))));
router.get("/friends/requests", async (req, res) => res.json(await friends.listRequests(uid(req))));

router.post("/friends/requests", async (req, res) => {
  const { userId, code } = req.body ?? {};
  if (!userId && !code) return res.status(400).json({ error: "Send userId or code" });
  res.status(201).json(await friends.sendRequest(uid(req), { userId: userId && String(userId), code: code && String(code) }));
});
router.post("/friends/requests/:id/accept", async (req, res) => res.json(await friends.respond(uid(req), id(req), true)));
router.post("/friends/requests/:id/decline", async (req, res) => res.json(await friends.respond(uid(req), id(req), false)));

router.post("/friends/block", async (req, res) => {
  await friends.block(uid(req), String(req.body?.userId ?? ""));
  res.json({ ok: true });
});
router.post("/friends/report", async (req, res) => {
  await friends.report(uid(req), String(req.body?.userId ?? ""), req.body?.reason);
  res.status(201).json({ ok: true });
});

router.get("/friends/:id", async (req, res) => {
  const [info, record] = await Promise.all([friends.friendInfo(uid(req), id(req)), duels.rivalry(uid(req), id(req))]);
  res.json({ ...info, rivalry: record });
});
router.delete("/friends/:id", async (req, res) => {
  await friends.removeFriendship(uid(req), id(req));
  res.status(204).end();
});

router.get("/friends/:id/messages", async (req, res) => res.json(await friends.getMessages(uid(req), id(req), req.query.after)));
router.post("/friends/:id/messages", async (req, res) => res.status(201).json(await friends.sendMessage(uid(req), id(req), req.body?.text)));
router.post("/friends/:id/poke", async (req, res) => res.status(201).json(await friends.poke(uid(req), id(req))));

router.get("/friends/:id/duel", async (req, res) => res.json(await duels.todaysDuel(uid(req), id(req))));
router.post("/friends/:id/duel", async (req, res) => res.json(await duels.submitDuel(uid(req), id(req), req.body?.answers)));
router.get("/friends/:id/weekly", async (req, res) => res.json(await duels.thisWeeksQuiz(uid(req), id(req))));
router.post("/friends/:id/weekly", async (req, res) => res.json(await duels.submitWeekly(uid(req), id(req), req.body?.answers)));
