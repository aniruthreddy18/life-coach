// =============================================================
// routes/notifications.js
//   GET  /api/push/key          -> public key the browser needs to subscribe
//   POST /api/push/subscribe    -> save this browser's subscription for YOU
//   POST /api/push/unsubscribe  -> forget this browser (used on sign out)
//   POST /api/push/test         -> send yourself a test notification
// =============================================================
import { Router } from "express";
import { vapidPublicKey, saveSubscription, removeSubscription, notifyUser } from "../push.js";
import { getProfile } from "../state.js";
import { greeting } from "../messages.js";

export const router = Router();

router.get("/push/key", (req, res) => {
  if (!vapidPublicKey) return res.status(503).json({ error: "Notifications aren't ready yet. Try again in a moment." });
  res.json({ publicKey: vapidPublicKey });
});

router.post("/push/subscribe", async (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }
  await saveSubscription(req.user.id, sub);
  res.status(201).json({ ok: true });
});

router.post("/push/unsubscribe", async (req, res) => {
  if (req.body?.endpoint) await removeSubscription(req.user.id, String(req.body.endpoint));
  res.json({ ok: true });
});

router.post("/push/test", async (req, res) => {
  const profile = await getProfile(req.user.id);
  const body = profile ? greeting(profile.language, 1, profile.name) : "Notifications are working!";
  const sent = await notifyUser(req.user.id, "Coach 👋", `${body} — notifications are working!`);
  res.json({ sent });
});
