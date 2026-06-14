// ============================================================
// Joby — one-off schema migration (no drizzle-kit available)
//
// Idempotent: safe to run multiple times.
// - Adds worker_profiles.onboarding_completed_at, onboarding_skipped_at
//
// Run with: node scripts/migrate-onboarding.mjs   (from app/ directory)
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

  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz`;

  console.log("Migration complete: onboarding_completed_at, onboarding_skipped_at added to worker_profiles.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
