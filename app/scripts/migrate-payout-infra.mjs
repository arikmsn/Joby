// Migration: Daily payout infrastructure
// Creates payout_batches table and updates payout_ledger.batch_id to reference it
// Idempotent — safe to run multiple times
// Run with: node scripts/migrate-payout-infra.mjs   (from app/ directory)

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
  console.log("Running payout infrastructure migration...");

  await sql`
    CREATE TABLE IF NOT EXISTS payout_batches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_date date NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'PREPARED',
      items_count integer NOT NULL DEFAULT 0,
      total_gross decimal(12,2) NOT NULL DEFAULT 0,
      total_fees decimal(12,2) NOT NULL DEFAULT 0,
      total_net decimal(12,2) NOT NULL DEFAULT 0,
      prepared_by uuid REFERENCES users(id),
      created_at timestamptz DEFAULT now(),
      transferred_at timestamptz
    )
  `;
  console.log("  ✓ payout_batches table");

  // Drop old batch_id column (was varchar(100)) and recreate as uuid FK
  // Only if the column type is varchar — skip if already uuid
  const colInfo = await sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'payout_ledger' AND column_name = 'batch_id'
  `;

  if (colInfo.length > 0 && colInfo[0].data_type === 'character varying') {
    await sql`ALTER TABLE payout_ledger DROP COLUMN batch_id`;
    await sql`ALTER TABLE payout_ledger ADD COLUMN batch_id uuid REFERENCES payout_batches(id)`;
    console.log("  ✓ payout_ledger.batch_id updated to uuid FK");
  } else if (colInfo.length === 0) {
    await sql`ALTER TABLE payout_ledger ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES payout_batches(id)`;
    console.log("  ✓ payout_ledger.batch_id added");
  } else {
    console.log("  ✓ payout_ledger.batch_id already correct type");
  }

  // Add unique constraint on application_id to prevent duplicate ledger entries
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS payout_ledger_application_id_unique
    ON payout_ledger (application_id)
  `;
  console.log("  ✓ unique index on payout_ledger.application_id");

  console.log("Payout infrastructure migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
