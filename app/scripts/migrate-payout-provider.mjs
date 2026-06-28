// Migration: Payout provider abstraction layer
// Adds provider reference fields to payout_batches and payout_ledger
// Adds lifecycle timestamp columns (submitted_at, confirmed_at, failed_at)
// Widens status columns to varchar(30)
// Idempotent — safe to run multiple times
// Run with: node scripts/migrate-payout-provider.mjs   (from app/ directory)

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(__dirname, "..", ".env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      return trimmed.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("DATABASE_URL not found");
}

const sql = neon(loadDatabaseUrl());

async function migrate() {
  console.log("Running payout provider abstraction migration...");

  // --- payout_batches: widen status, add provider fields + lifecycle timestamps ---
  await sql`ALTER TABLE payout_batches ALTER COLUMN status TYPE varchar(30)`;
  console.log("  ✓ payout_batches.status widened to varchar(30)");

  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS provider_name varchar(50)`;
  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS provider_batch_id varchar(255)`;
  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS provider_status varchar(50)`;
  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS provider_message text`;
  console.log("  ✓ payout_batches provider reference fields");

  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS submitted_at timestamptz`;
  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS confirmed_at timestamptz`;
  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS failed_at timestamptz`;
  console.log("  ✓ payout_batches lifecycle timestamps");

  // --- payout_ledger: add provider fields + lifecycle timestamps ---
  await sql`ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS provider_transfer_id varchar(255)`;
  await sql`ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS provider_status varchar(50)`;
  await sql`ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS provider_message text`;
  console.log("  ✓ payout_ledger provider reference fields");

  await sql`ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS submitted_at timestamptz`;
  await sql`ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS failed_at timestamptz`;
  console.log("  ✓ payout_ledger lifecycle timestamps");

  console.log("Payout provider abstraction migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
