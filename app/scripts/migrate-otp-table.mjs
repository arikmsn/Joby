// ============================================================
// Joby — OTP table migration (no drizzle-kit available)
//
// Idempotent: safe to run multiple times.
// - Creates otp_codes table (replaces in-memory OTP store)
// - Creates otp_rate_limits table (replaces in-memory rate limit store)
//
// Run with: node scripts/migrate-otp-table.mjs   (from app/ directory)
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

  console.log("== Creating otp_codes table ==");
  await sql`
    CREATE TABLE IF NOT EXISTS otp_codes (
      phone varchar(20) PRIMARY KEY,
      otp varchar(10) NOT NULL,
      expires_at timestamptz NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now()
    )
  `;

  console.log("== Creating otp_rate_limits table ==");
  await sql`
    CREATE TABLE IF NOT EXISTS otp_rate_limits (
      phone varchar(20) PRIMARY KEY,
      count integer NOT NULL DEFAULT 1,
      reset_at timestamptz NOT NULL
    )
  `;

  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
