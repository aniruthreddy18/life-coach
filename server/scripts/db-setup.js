// =============================================================
// db-setup.js — create the tables in your Supabase database
// Run from the server folder:  npm run db:setup
// Safe to run again: every statement says "if not exists".
// (Your Supabase project already has the tables — this is for a
// new project, or if you ever reset the database.)
// =============================================================
import "../src/env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

// Run in this order: the base tables, then the study-buddies tables
const dbDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db");
const files = ["schema.sql", "friends.sql", "curriculum.sql"].map((f) => path.join(dbDir, f));

if (!process.env.DATABASE_URL) {
  console.error("\n❌ DATABASE_URL is missing in server/.env (see the comments in .env.example).\n");
  process.exit(1);
}
try {
  for (const file of files) await pool.query(fs.readFileSync(file, "utf8")); // pg runs a multi-statement file in one go
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  console.log(`\n✅ Database ready — ${rows.length} tables: ${rows.map((r) => r.table_name).join(", ")}\n`);
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
