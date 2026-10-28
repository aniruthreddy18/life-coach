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

// Ask the server which sign-in to use; set up Supabase only for "otp"
export async function initAuth() {
  const res = await fetch("/api/config").catch(() => null);
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

// Email mode: one request, and you're in
export async function signInWithEmail(email) {
  const res = await fetch("/api/auth/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => null);
  if (!res) throw new Error("Can't reach the server. Is it running?");
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Sign-in failed. Try again.");
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
  return data;
}

export async function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  if (mode === "otp") await supabase()?.auth.signOut({ scope: "local" }); // this device only
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
