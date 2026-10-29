// =============================================================
// api.js — the ONLY place the frontend talks to the backend.
// Every page calls these functions instead of using fetch() directly.
//
// Every request carries your sign-in token:
//     Authorization: Bearer <access token>
// The server checks it and only shows YOUR data. If the server says
// 401 ("who are you?"), the session is dead, so we sign you out.
// =============================================================
import { accessToken } from "./auth.js";

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function authHeaders(extra = {}) {
  const token = await accessToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

// Generic helper: sends a request, returns the parsed JSON,
// and turns error responses (4xx/5xx) into thrown Errors.
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: await authHeaders(body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (res.status === 401) onUnauthorized();
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Chat is special: the reply arrives in pieces (streaming).
// We read the response body chunk by chunk and hand each piece to onText.
export async function streamChat(message, onText) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ message }),
  });
  if (res.status === 401) onUnauthorized();
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Chat failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
}

// Ask permission + subscribe this browser to push notifications
export async function enableNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser doesn't support push notifications.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were blocked. Allow them in browser settings.");

  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api("/push/key");
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToBytes(publicKey),
  });
  await api("/push/subscribe", { method: "POST", body: subscription.toJSON() });
}

// Signing out: stop notifications on THIS device for this account.
// Runs in the background AFTER sign-out (with the old token), so a slow or
// sleeping server never blocks signing out.
export async function disableNotificationsHere(token) {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    await sub.unsubscribe(); // this browser stops receiving pushes right away
    if (token) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
        signal: AbortSignal.timeout(15_000),
      });
    }
  } catch {
    // not fatal: you're already signed out
  }
}

function base64ToBytes(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
