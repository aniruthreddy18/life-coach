// =============================================================
// push.js — SENDING NOTIFICATIONS
// -------------------------------------------------------------
// How Web Push works:
//  1. The browser asks you "Allow notifications?" -> you say yes.
//  2. The browser gives us a "subscription" (a unique URL at
//     Google/Apple/Mozilla's push service + encryption keys).
//  3. We save it in the database, next to YOUR user id.
//  4. Later, the server POSTs a message to that URL, signed with
//     our VAPID keys (proves the message really came from us).
//  5. The push service wakes up your browser's service worker
//     (client/public/sw.js), which shows the notification.
// One student can have several devices (phone + laptop), so
// notifyUser() sends to every subscription that student has.
// =============================================================
import webpush from "web-push";
import { all, run, getSetting, setSetting } from "./db.js";

export let vapidPublicKey = null;

// VAPID keys are generated once and saved in the database, so
// subscriptions keep working after a restart. Called at startup.
export async function initPush() {
  let publicKey = await getSetting("vapid_public");
  let privateKey = await getSetting("vapid_private");
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    await setSetting("vapid_public", publicKey);
    await setSetting("vapid_private", privateKey);
  }
  webpush.setVapidDetails("mailto:coach@example.com", publicKey, privateKey);
  vapidPublicKey = publicKey;
}

export async function saveSubscription(uid, subscription) {
  // Same browser, different person signed in? The device now belongs to them.
  await run(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription) VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, subscription = excluded.subscription`,
    uid, subscription.endpoint, JSON.stringify(subscription),
  );
}

// Signing out on a device: stop sending that device notifications
export async function removeSubscription(uid, endpoint) {
  await run("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", uid, endpoint);
}

export async function notifyUser(uid, title, body, url = "/") {
  if (!vapidPublicKey) return 0;
  const subs = await all("SELECT * FROM push_subscriptions WHERE user_id = $1", uid);
  console.log(`🔔 ${title} — ${body.split("\n")[0]} (${subs.length} device(s))`);
  const payload = JSON.stringify({ title, body, url });
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, payload); // jsonb is already an object
    } catch (err) {
      // 404/410 = that browser unsubscribed; forget it
      if (err.statusCode === 404 || err.statusCode === 410) {
        await run("DELETE FROM push_subscriptions WHERE id = $1", s.id);
      } else {
        console.error("Push failed:", err.statusCode ?? err.message);
      }
    }
  }
  return subs.length;
}
