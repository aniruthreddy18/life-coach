// =============================================================
// auth.js (browser) — ONE place that knows how you're signed in
// -------------------------------------------------------------
// The server tells us the mode (GET /api/config):
//   "email" -> type your email, the server gives us a session token.
//              We keep it in localStorage, so you stay signed in
//              until you press Sign out.
//   "otp"   -> Supabase emails a code (see supabase.js); supabase-js
//              keeps and refreshes its own session.
// The rest of the app only uses the functions below, so switching
// modes later needs no changes anywhere else.
// =============================================================
import { initSupabase, supabase } from "./supabase.js";

const KEY = "lc-session"; // { token, user: { id, email } }
let mode = null;

const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
};

// Free hosting (Render) puts the server to sleep when nobody uses it; the
// first request then takes up to ~1 minute while it wakes. So we retry
// network errors and "waking up" answers (502/503/504) for up to 90 s,
// calling onWaiting() so the screen can say what's happening.
export async function fetchWithWake(url, options = {}, onWaiting) {
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
      if (![502, 503, 504].includes(res.status) || Date.now() > deadline) return res;
    } catch (err) {
      if (Date.now() > deadline) throw err;
    }
    onWaiting?.();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

// Ask the server which sign-in to use; set up Supabase only for "otp"
export async function initAuth(onWaiting) {
  const res = await fetchWithWake("/api/config", {}, onWaiting).catch(() => null);
  if (!res?.ok) throw Object.assign(new Error("Server not reachable"), { kind: "server" });
  const config = await res.json();
  mode = config.authMode === "otp" ? "otp" : "email";
  if (mode === "otp") await initSupabase(config);
  return mode;
}

export const authMode = () => mode;

// Who's signed in on this device? null = nobody
export async function getSession() {
  if (mode === "otp") {
    const { data } = await supabase().auth.getSession();
    return data.session ? { user: data.session.user } : null;
  }
  return readSession();
}

// The token every API call sends (api.js)
export async function accessToken() {
  if (mode === "otp") {
    const { data } = await supabase().auth.getSession(); // refreshed automatically if expired
    return data.session?.access_token ?? null;
  }
  return readSession()?.token ?? null;
}

// Email mode: one request, and you're in (an existing email = the same account)
export async function signInWithEmail(email, onWaiting) {
  const res = await fetchWithWake(
    "/api/auth/email",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) },
    onWaiting,
  ).catch(() => null);
  if (!res) throw new Error("Can't reach Life Coach right now. Check your internet and try again.");
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Sign-in failed. Try again.");
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
  return data;
}

// Signing out only forgets the session ON THIS DEVICE, so it never waits
// for the server (and works even offline or while the server is asleep).
export async function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  if (mode === "otp") {
    // supabase-js also tells Supabase; don't let a slow network keep you signed in
    await Promise.race([supabase()?.auth.signOut({ scope: "local" }), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  }
}

// Signed out somewhere else (another tab) -> call fn
export function onSignedOut(fn) {
  if (mode === "otp") {
    const { data } = supabase().auth.onAuthStateChange((event) => event === "SIGNED_OUT" && fn());
    return () => data.subscription.unsubscribe();
  }
  const onStorage = (e) => e.key === KEY && !e.newValue && fn();
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
