// =============================================================
// db.js — THE DATABASE LAYER (PostgreSQL on Supabase)
// -------------------------------------------------------------
// We talk to Postgres with the "pg" library through a CONNECTION
// POOL: a few open connections that requests take turns using,
// instead of opening a new connection for every query (slow).
//
// The tables are defined in server/db/schema.sql (already applied
// to your Supabase project). Run `npm run db:setup` to apply it to
// a different database.
//
// Postgres placeholders are $1, $2, $3… — values are sent separately
// from the SQL text, so user input can never change the query
// (this is how SQL injection is prevented).
// =============================================================
import pg from "pg";

// Make Postgres types come back as simple JS values:
pg.types.setTypeParser(1082, (v) => v);         // date    -> "2026-10-28" (string, no time zone surprises)
pg.types.setTypeParser(20, (v) => Number(v));   // bigint  -> number (ids, COUNT(*))
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric -> number (costs)

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // index.js stops with a clear message if it's missing
  max: 5,
  // Supabase requires an encrypted (SSL) connection. Its certificate is
  // signed by Supabase's own authority, so we don't verify the chain here;
  // the connection is still encrypted. Set DATABASE_SSL=off for a local DB.
  ssl: process.env.DATABASE_SSL === "off" ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => console.error("Database connection error:", err.message));

// Small helpers so the rest of the code reads nicely
export async function all(sql, ...params) {
  return (await pool.query(sql, params)).rows;
}
export async function get(sql, ...params) {
  return (await pool.query(sql, params)).rows[0];
}
export async function run(sql, ...params) {
  return pool.query(sql, params); // .rowCount = how many rows changed
}

// TRANSACTION: several changes that ALL succeed or ALL fail.
// Usage: await transaction(async (q) => { await q("INSERT…", a); await q("UPDATE…", b); });
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn((sql, ...params) => client.query(sql, params));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release(); // give the connection back to the pool
  }
}

// App-wide key/value settings (e.g. push-notification keys)
export async function getSetting(key) {
  return (await get("SELECT value FROM app_settings WHERE key = $1", key))?.value;
}
export async function setSetting(key, value) {
  await run(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

// Dates as "YYYY-MM-DD" in the server's local time zone
// The app's clock: India time (IST) by default, whatever time zone the
// server computer uses. A new day starts at midnight IST for everyone.
// Change APP_TIMEZONE in .env to run it for another country.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const ymdFormat = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

// Today's date as "YYYY-MM-DD" in APP_TIMEZONE (offsetDays: -1 = yesterday)
export function today(offsetDays = 0) {
  const ymd = ymdFormat.format(new Date()); // en-CA prints YYYY-MM-DD
  if (!offsetDays) return ymd;
  const d = new Date(ymd + "T00:00:00Z"); // date maths in UTC: no daylight-saving surprises
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
