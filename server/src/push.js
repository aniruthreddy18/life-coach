// =============================================================
// push.js — SENDING NOTIFICATIONS
// -------------------------------------------------------------
// How Web Push works:
//  1. The browser asks you "Allow notifications?" -> you say yes.
//  2. The browser gives us a "subscription" (a unique URL at
//     Google/Apple/Mozilla's push service + encryption keys).
//  3. We save it in the database.
//  4. Later, the server POSTs a message to that URL, signed with
//     our VAPID keys (proves the message really came from us).
//  5. The push service wakes up your browser's service worker
//     (client/public/sw.js), which shows the notification.
// =============================================================
import webpush from "web-push";
import { all, run, getSetting, setSetting } from "./db.js";

// VAPID keys are generated once and saved, so subscriptions keep working.
function vapidKeys() {
  let publicKey = getSetting("vapid_public");
  let privateKey = getSetting("vapid_private");
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    setSetting("vapid_public", publicKey);
    setSetting("vapid_private", privateKey);
  }
  return { publicKey, privateKey };
}

const keys = vapidKeys();
webpush.setVapidDetails("mailto:coach@example.com", keys.publicKey, keys.privateKey);

export const vapidPublicKey = keys.publicKey;

export function saveSubscription(subscription) {
  run(
    `INSERT INTO push_subscriptions (endpoint, subscription) VALUES (?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription`,
    subscription.endpoint,
    JSON.stringify(subscription),
  );
}

export async function notifyAll(title, body, url = "/") {
  const subs = all("SELECT * FROM push_subscriptions");
  const payload = JSON.stringify({ title, body, url });
  for (const s of subs) {
    try {
      await webpush.sendNotification(JSON.parse(s.subscription), payload);
    } catch (err) {
      // 404/410 = that browser unsubscribed; forget it
      if (err.statusCode === 404 || err.statusCode === 410) {
        run("DELETE FROM push_subscriptions WHERE id = ?", s.id);
      } else {
        console.error("Push failed:", err.statusCode ?? err.message);
      }
    }
  }
  return subs.length;
}
