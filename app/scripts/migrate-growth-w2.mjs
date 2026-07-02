#!/usr/bin/env node
// Growth W2 migration — additive-only (see CLAUDE.md Migration Safety Policy).
// Adds intake_rate_limits for the public intake endpoint hardening.
// Run: node scripts/migrate-growth-w2.mjs   (from app/)

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  } catch {
    /* fall through */
  }
}
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS intake_rate_limits (
    key varchar(80) PRIMARY KEY,
    count integer NOT NULL DEFAULT 1,
    reset_at timestamptz NOT NULL
  )`,
];

for (const stmt of statements) {
  const label = stmt.trim().slice(0, 72).replace(/\s+/g, " ");
  try {
    await sql(stmt);
    console.log("✓", label);
  } catch (err) {
    console.error("✗", label);
    console.error(" ", err.message);
    process.exit(1);
  }
}

console.log("\n✅ Growth W2 migration applied (additive-only).");
