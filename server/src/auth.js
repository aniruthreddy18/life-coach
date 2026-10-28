// =============================================================
// auth.js — WHO IS MAKING THIS REQUEST?
// -------------------------------------------------------------
// Sign-in happens in the browser with Supabase Auth (email + OTP).
// After signing in, the browser holds an ACCESS TOKEN (a JWT: a
// signed note saying "this is user 1234, valid until 3pm").
// It sends that token with every API call:
//
//     Authorization: Bearer eyJhbGciOi...
//
// requireUser() checks the token is real and not expired, then puts
// the user on req.user. Every database query uses req.user.id, so a
// student can only ever see and change THEIR OWN data.
// =============================================================
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from "jose";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

// Supabase publishes the PUBLIC keys that verify its tokens here.
// jose downloads and caches them, so most checks need no network call.
const jwks = SUPABASE_URL ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)) : null;

// Older projects sign tokens with a shared secret (HS256) that we don't
// have. For those we ask Supabase "who is this?" and remember the
// answer for a minute, so we don't ask on every request.
const cache = new Map(); // token -> { user, until }

async function askSupabase(token) {
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Supabase rejected the token (${res.status})`), { unreachable: res.status >= 500 });
  const u = await res.json();
  const user = { id: u.id, email: u.email };
  cache.set(token, { user, until: Date.now() + 60_000 });
  if (cache.size > 1000) cache.clear(); // keep memory bounded
  return user;
}

export async function verifyToken(token) {
  const { alg } = decodeProtectedHeader(token);
  if (alg === "HS256") return askSupabase(token);
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `${SUPABASE_URL}/auth/v1`,
    audience: "authenticated",
  });
  return { id: payload.sub, email: payload.email };
}

// Express middleware: put this in front of every private route
export async function requireUser(req, res, next) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    return res.status(500).json({ error: "Server is missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY in server/.env." });
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please sign in." });
  try {
    req.user = await verifyToken(token);
    if (!req.user.id) throw new Error("token has no user id");
    next();
  } catch (err) {
    // Can't REACH Supabase (network down)? -> 503, so you stay signed in.
    // Anything else means a bad/expired token -> 401 (the app signs you out).
    const unreachable =
      err.unreachable || err.code === "ERR_JWKS_TIMEOUT" || err.code === "ERR_JOSE_GENERIC" ||
      err.message === "fetch failed" || err.name === "TimeoutError";
    console.warn("Auth failed:", err.code ?? "", err.message);
    if (!unreachable) return res.status(401).json({ error: "Your session expired. Please sign in again." });
    res.status(503).json({ error: "Can't reach the sign-in service right now. Check your internet and try again." });
  }
}

export const supabasePublicConfig = () => ({ supabaseUrl: SUPABASE_URL, publishableKey: PUBLISHABLE_KEY });
