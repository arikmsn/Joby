// ============================================================
// Joby — one-off schema migration (no drizzle-kit available)
//
// Idempotent: safe to run multiple times.
// - Creates occupation_catalog, incidents, notifications tables
// - Adds users.created_by_admin
// - Seeds occupation_catalog with DEFAULT_OCCUPATIONS (ON CONFLICT DO NOTHING)
// - Prints a non-destructive migration report of any worker_profiles
//   experience_tags values that don't match a catalog key (these are left
//   untouched in the DB)
//
// Run with: node scripts/migrate.mjs   (from app/ directory)
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

const DEFAULT_OCCUPATIONS = [
  { key: "waiter", label_he: "מלצרות" },
  { key: "bartender", label_he: "ברמנות" },
  { key: "hostess", label_he: "קבלת אורחים" },
  { key: "sales-promoter", label_he: "קידום מכירות" },
  { key: "cashier", label_he: "קופאות" },
  { key: "customer-service", label_he: "שירות לקוחות" },
  { key: "kitchen", label_he: "עבודת מטבח" },
  { key: "dishwashing", label_he: "שטיפת כלים" },
  { key: "courier", label_he: "שליחויות" },
  { key: "picker-packer", label_he: "ליקוט ואריזה" },
  { key: "warehouse", label_he: "עבודת מחסן" },
  { key: "steward", label_he: "סדרנות" },
  { key: "setup-teardown", label_he: "הקמה ופירוק" },
  { key: "logistics", label_he: "לוגיסטיקה" },
  { key: "driver", label_he: "נהיגה" },
  { key: "security", label_he: "אבטחה" },
  { key: "brand-promotion", label_he: "פרומוטרים" },
  { key: "events-general", label_he: "צוות אירועים כללי" },
  { key: "cleaning", label_he: "ניקיון" },
  { key: "general", label_he: "כללי" },
];

async function main() {
  const sql = neon(loadDatabaseUrl());

  console.log("== Creating new tables (if not exist) ==");

  await sql`
    CREATE TABLE IF NOT EXISTS occupation_catalog (
      id uuid primary key default gen_random_uuid(),
      key varchar(50) unique not null,
      label_he varchar(100) not null,
      sort_order integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz default now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id uuid primary key default gen_random_uuid(),
      incident_type varchar(30) not null,
      severity varchar(20) not null default 'MEDIUM',
      status varchar(20) not null default 'OPEN',
      title varchar(255) not null,
      description text,
      related_user_id uuid references users(id) on delete set null,
      related_shift_id uuid references shifts(id) on delete set null,
      related_application_id uuid references applications(id) on delete set null,
      created_by_user_id uuid references users(id) on delete set null,
      assigned_admin_id uuid references users(id) on delete set null,
      resolution_notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      resolved_at timestamptz
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      type varchar(50) not null,
      title varchar(255) not null,
      body text,
      payload jsonb,
      channel varchar(20) not null default 'in_app',
      is_read boolean not null default false,
      created_at timestamptz default now()
    )
  `;

  console.log("== Altering users table ==");
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin boolean not null default false`;

  console.log("== Seeding occupation_catalog ==");
  for (let i = 0; i < DEFAULT_OCCUPATIONS.length; i++) {
    const { key, label_he } = DEFAULT_OCCUPATIONS[i];
    await sql`
      INSERT INTO occupation_catalog (key, label_he, sort_order, is_active)
      VALUES (${key}, ${label_he}, ${i}, true)
      ON CONFLICT (key) DO NOTHING
    `;
  }

  const catalogRows = await sql`SELECT key FROM occupation_catalog ORDER BY sort_order`;
  console.log(`occupation_catalog now has ${catalogRows.length} rows`);

  console.log("\n== Legacy experience_tags migration report (non-destructive) ==");
  const catalogKeys = new Set(catalogRows.map((r) => r.key));
  const workers = await sql`
    SELECT wp.user_id, u.full_name, wp.experience_tags
    FROM worker_profiles wp
    JOIN users u ON u.id = wp.user_id
    WHERE wp.experience_tags IS NOT NULL AND array_length(wp.experience_tags, 1) > 0
  `;

  let mismatchCount = 0;
  for (const w of workers) {
    const unmatched = (w.experience_tags || []).filter((tag) => !catalogKeys.has(tag));
    if (unmatched.length > 0) {
      mismatchCount++;
      console.log(
        `  - ${w.full_name} (${w.user_id}): legacy tags not in catalog -> [${unmatched.join(", ")}] (left as-is)`
      );
    }
  }
  if (mismatchCount === 0) {
    console.log("  (no mismatches found — all existing experience_tags already match catalog keys)");
  }

  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
