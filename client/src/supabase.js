// =============================================================
// supabase.js — the CODE sign-in client (Supabase Auth, AUTH_MODE=otp)
// -------------------------------------------------------------
// The browser talks to Supabase ONLY for signing in:
//   1. signInWithOtp({ email })  -> Supabase emails a 6-digit code
//   2. verifyOtp({ email, token }) -> code is right? You get a SESSION
//      (an access token + a refresh token)
// supabase-js saves the session in localStorage and refreshes it
// automatically, so you STAY signed in (even after closing the
// browser) until you press "Sign out".
//
// The URL + publishable key are public (safe in the browser). We get
// them from our own server (/api/config), so they live in ONE place:
// server/.env. All the app's DATA still goes through our server.
// =============================================================
let client = null;

// config comes from GET /api/config (auth.js fetches it)
export async function initSupabase({ supabaseUrl, publishableKey }) {
  if (client) return client;
  if (!supabaseUrl || !publishableKey) throw Object.assign(new Error("Supabase isn't configured"), { kind: "config" });
  // Loaded on demand, so the library downloads in parallel with the rest of the app
  const { createClient } = await import("@supabase/supabase-js");
  client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

// After initSupabase() has run once, anyone can grab the client
export const supabase = () => client;

// Turn Supabase's error codes into messages a person understands
export function friendlyAuthError(error) {
  const code = error?.code ?? "";
  if (code === "email_address_not_authorized") {
    return "This email can't get codes yet. The app owner needs to set up email sending (Gmail SMTP) in Supabase — see the README.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error?.status === 429) {
    return "Too many codes requested. Wait a minute, then try again.";
  }
  if (code === "otp_expired" || code === "otp_disabled" || /token has expired|invalid/i.test(error?.message ?? "")) {
    return "That code is wrong or expired. Use the newest email, or tap Resend.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") return "That email address doesn't look right.";
  if (code === "signup_disabled") return "New sign-ups are turned off for this app.";
  if (error?.name === "AuthRetryableFetchError" || error?.status === 0) {
    return "Can't reach the sign-in service. Check your internet and try again.";
  }
  return error?.message || "Something went wrong. Try again.";
}
