// ============================================================
// Joby — one-off schema migration (no drizzle-kit available)
//
// Idempotent: safe to run multiple times.
// - Creates worker_invites table (employer -> phone-number invites)
//
// Run with: node scripts/migrate-worker-invites.mjs   (from app/ directory)
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
  const sql = loadDatabaseUrl();
  const db = neon(sql);

  await db`
    CREATE TABLE IF NOT EXISTS worker_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_phone varchar(20) NOT NULL,
      normalized_phone varchar(20) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'PENDING',
      sent_at timestamptz DEFAULT now(),
      joined_at timestamptz,
      message_provider varchar(50),
      provider_message_id varchar(100),
      last_error text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;

  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS worker_invites_employer_phone_idx
    ON worker_invites (employer_id, normalized_phone)
  `;

  await db`
    CREATE INDEX IF NOT EXISTS worker_invites_normalized_phone_idx
    ON worker_invites (normalized_phone)
  `;

  console.log("Migration complete: worker_invites table created.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
