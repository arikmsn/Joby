#!/usr/bin/env node
// Growth Stage-1 migration — additive-only (CLAUDE.md Migration Safety Policy).
// Adds collector freshness tracking to source_channels.
// Run: node scripts/migrate-growth-stage1.mjs   (from app/)

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
  `ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS last_collected_at timestamptz`,
  `ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS last_collect_error text`,
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

console.log("\n✅ Growth Stage-1 migration applied (additive-only).");
