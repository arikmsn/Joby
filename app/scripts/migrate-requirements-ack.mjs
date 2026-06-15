// ============================================================
// Joby — one-off schema migration (no drizzle-kit available)
//
// Idempotent: safe to run multiple times.
// - Adds shifts.requirements_ack
//
// Run with: node scripts/migrate-requirements-ack.mjs   (from app/ directory)
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

  await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS requirements_ack text`;

  console.log("Migration complete: requirements_ack added to shifts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
