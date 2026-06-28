// Migration: Vendor/payout readiness groundwork
// Adds supplier_type, tax_id, payout_ready to worker_profiles
// Creates payout_ledger table (schema only, no transfer logic)
// Idempotent — safe to run multiple times
// Run with: node scripts/migrate-vendor-payout.mjs   (from app/ directory)

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
  console.log("Running vendor/payout readiness migration...");

  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS supplier_type varchar(30)`;
  console.log("  ✓ supplier_type column");

  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS tax_id varchar(50)`;
  console.log("  ✓ tax_id column");

  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_ready boolean NOT NULL DEFAULT false`;
  console.log("  ✓ payout_ready column");

  await sql`
    CREATE TABLE IF NOT EXISTS payout_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_id uuid NOT NULL REFERENCES applications(id),
      shift_id uuid NOT NULL REFERENCES shifts(id),
      gross_amount decimal(10,2) NOT NULL,
      platform_fee decimal(10,2) NOT NULL,
      net_amount decimal(10,2) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'PENDING',
      batch_id varchar(100),
      created_at timestamptz DEFAULT now(),
      transferred_at timestamptz,
      confirmed_at timestamptz
    )
  `;
  console.log("  ✓ payout_ledger table");

  console.log("Vendor/payout readiness migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
