// ============================================================
// Joby — one-off schema migration (no drizzle-kit available)
//
// Idempotent: safe to run multiple times.
// - Adds applications.payment_status / approved_for_payment_at / paid_at
// - Adds worker_profiles payout detail columns
// - Creates employer_worker_relations table (known workers / preferred)
//
// Run with: node scripts/migrate-sprint6.mjs   (from app/ directory)
// ============================================================

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
      return trimmed.slice("DATABASE_URL=".length).trim();
    }
  }
  throw new Error("DATABASE_URL not found in .env.local");
}

async function main() {
  const sql = neon(loadDatabaseUrl());

  console.log("== Altering applications table ==");
  await sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_status varchar(30) not null default 'PENDING'`;
  await sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS approved_for_payment_at timestamptz`;
  await sql`ALTER TABLE applications ADD COLUMN IF NOT EXISTS paid_at timestamptz`;

  console.log("== Altering worker_profiles table (payout details) ==");
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_legal_name varchar(255)`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_id_number varchar(50)`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_bank_name varchar(100)`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_bank_branch varchar(20)`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_account_number varchar(50)`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_account_holder varchar(255)`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS payout_details_completed_at timestamptz`;

  console.log("== Creating employer_worker_relations table (if not exists) ==");
  await sql`
    CREATE TABLE IF NOT EXISTS employer_worker_relations (
      id uuid primary key default gen_random_uuid(),
      employer_id uuid not null references users(id) on delete cascade,
      worker_id uuid not null references users(id) on delete cascade,
      is_preferred boolean not null default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS employer_worker_relations_unique
    ON employer_worker_relations (employer_id, worker_id)
  `;

  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
