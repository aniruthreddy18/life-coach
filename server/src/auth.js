// =============================================================
// auth.js — WHO IS MAKING THIS REQUEST?
// -------------------------------------------------------------
// Two ways to sign in, chosen by AUTH_MODE in server/.env:
//
//   AUTH_MODE=email (default for now)
//     You type your email -> POST /api/auth/email -> we find (or
//     create) your row in app_users and give you a SESSION TOKEN.
//     No code, no email sent. Simple, but anyone who types your
//     email can open your account, so it's for testing with friends.
//
//   AUTH_MODE=otp (later)
//     Supabase Auth emails a 6-digit code; the browser gets a
//     Supabase token. We check it and look you up in app_users
//     by email, so your data is the same in both modes.
//
// Either way the browser sends the token with every API call:
//
//     Authorization: Bearer eyJhbGciOi...
//
// requireUser() checks the token is real and not expired, then puts
// the user on req.user. Every database query uses req.user.id, so a
// student can only ever see and change THEIR OWN data.
// =============================================================
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, decodeJwt } from "jose";
import { get, getSetting, setSetting } from "./db.js";

export const AUTH_MODE = (process.env.AUTH_MODE || "email").toLowerCase() === "otp" ? "otp" : "email";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const ISSUER = "life-coach";
const SESSION_DAYS = 365; // you stay signed in until you press Sign out

export const isEmail = (v) => typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

// ---- Our own session tokens (email mode) --------------------------------
// Signed with a secret that only the server knows. It's generated once
// and kept in the database, so sessions survive a server restart.
let secret = null;
export async function initAuth() {
  let value = await getSetting("session_secret");
  if (!value) {
    value = crypto.randomBytes(32).toString("base64url");
    await setSetting("session_secret", value);
  }
  secret = new TextEncoder().encode(value);
}

// Find your row by email, or create it the first time
async function userForEmail(email) {
  const clean = email.trim().toLowerCase();
  return get(
    `INSERT INTO app_users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET last_seen_at = now()
     RETURNING id, email`,
    clean,
  );
}

// POST /api/auth/email -> { token, user }
export async function signInWithEmail(email) {
  const user = await userForEmail(email);
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret);
  return { token, user };
}

// ---- Supabase tokens (OTP mode) ---------------------------------------------
// Supabase publishes the PUBLIC keys that verify its tokens here.
// jose downloads and caches them, so most checks need no network call.
const jwks = SUPABASE_URL ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)) : null;
const idByEmail = new Map(); // email -> app_users.id, so we don't look it up every request

async function verifySupabaseToken(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `${SUPABASE_URL}/auth/v1`,
    audience: "authenticated",
  });
  if (!payload.email) throw new Error("token has no email");
  if (!idByEmail.has(payload.email)) idByEmail.set(payload.email, (await userForEmail(payload.email)).id);
  return { id: idByEmail.get(payload.email), email: payload.email };
}

export async function verifyToken(token) {
  const { iss } = decodeJwt(token); // just READS the token; jwtVerify below checks the signature
  if (iss === ISSUER) {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    return { id: payload.sub, email: payload.email };
  }
  if (AUTH_MODE !== "otp" || !jwks) throw new Error("token type not accepted");
  return verifySupabaseToken(token);
}

// Express middleware: put this in front of every private route
export async function requireUser(req, res, next) {
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
      err.code === "ERR_JWKS_TIMEOUT" || err.code === "ERR_JOSE_GENERIC" ||
      err.message === "fetch failed" || err.name === "TimeoutError";
    console.warn("Auth failed:", err.code ?? "", err.message);
    if (!unreachable) return res.status(401).json({ error: "Your session expired. Please sign in again." });
    res.status(503).json({ error: "Can't reach the sign-in service right now. Check your internet and try again." });
  }
}

// What the browser needs to draw the right sign-in screen
export const publicAuthConfig = () => ({
  authMode: AUTH_MODE,
  supabaseUrl: AUTH_MODE === "otp" ? SUPABASE_URL : "",
  publishableKey: AUTH_MODE === "otp" ? PUBLISHABLE_KEY : "",
});
