// =============================================================
// routes/notifications.js
//   GET  /api/push/key        -> public key the browser needs to subscribe
//   POST /api/push/subscribe  -> save this browser's subscription
//   POST /api/push/test       -> send a test notification
// =============================================================
import { Router } from "express";
import { vapidPublicKey, saveSubscription, notifyAll } from "../push.js";

export const router = Router();

router.get("/push/key", (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

router.post("/push/subscribe", (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }
  saveSubscription(sub);
  res.status(201).json({ ok: true });
});

router.post("/push/test", async (req, res) => {
  const sent = await notifyAll("Coach 👋", "Notifications are working! I'll keep you on track.");
  res.json({ sent });
});
