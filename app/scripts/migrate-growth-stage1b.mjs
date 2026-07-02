#!/usr/bin/env node
// Growth Stage-1f migration — additive-only (CLAUDE.md Migration Safety Policy).
// Admin-configurable crawling: crawl config on source_channels, run history
// table, and review-queue priority on source_jobs.
// Run: node scripts/migrate-growth-stage1b.mjs   (from app/)

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
  `ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS crawl_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS config jsonb`,
  `ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS next_run_at timestamptz`,
  `ALTER TABLE source_channels ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0`,
  `ALTER TABLE source_jobs ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS collector_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid REFERENCES source_channels(id) ON DELETE CASCADE,
    job varchar(30) NOT NULL,
    trigger varchar(10) NOT NULL,
    status varchar(15) NOT NULL DEFAULT 'running',
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    pages_crawled integer NOT NULL DEFAULT 0,
    urls_discovered integer NOT NULL DEFAULT 0,
    items_ingested integer NOT NULL DEFAULT 0,
    duplicates integer NOT NULL DEFAULT 0,
    filtered_out integer NOT NULL DEFAULT 0,
    error text,
    stats jsonb,
    triggered_by uuid REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS collector_runs_channel_idx ON collector_runs (channel_id, started_at)`,
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

console.log("\n✅ Growth Stage-1f migration applied (additive-only).");
