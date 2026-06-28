// Migration: Payout audit layer
// Adds calculation jsonb to payout_ledger, warnings_count + notes to payout_batches
// Idempotent — safe to run multiple times
// Run with: node scripts/migrate-payout-audit.mjs   (from app/ directory)

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
  console.log("Running payout audit layer migration...");

  await sql`ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS calculation jsonb`;
  console.log("  ✓ payout_ledger.calculation column");

  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS warnings_count integer NOT NULL DEFAULT 0`;
  console.log("  ✓ payout_batches.warnings_count column");

  await sql`ALTER TABLE payout_batches ADD COLUMN IF NOT EXISTS notes text`;
  console.log("  ✓ payout_batches.notes column");

  console.log("Payout audit layer migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
