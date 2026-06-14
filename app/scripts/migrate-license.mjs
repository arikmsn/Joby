// ============================================================
// Joby — one-off schema migration (no drizzle-kit available)
//
// Idempotent: safe to run multiple times.
// - Adds worker_profiles.has_license, license_types, vehicle_types
//
// Run with: node scripts/migrate-license.mjs   (from app/ directory)
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

  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS has_license boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS license_types text[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS vehicle_types text[] NOT NULL DEFAULT '{}'`;

  console.log("Migration complete: has_license, license_types, vehicle_types added to worker_profiles.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
