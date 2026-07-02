#!/usr/bin/env node
// ============================================================
// Growth module migration — additive-only DDL mirroring
// src/lib/schema.ts (execution pack §6). Used instead of
// `drizzle-kit push` because the live DB has pre-existing drift
// on `users` that push wants to resolve destructively.
// Safe to re-run: every statement is IF NOT EXISTS.
//
// Run: node scripts/migrate-growth.mjs   (from app/, needs DATABASE_URL)
// ============================================================

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  } catch {
    /* fall through */
  }
}
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);

const statements = [
  // users: growth sub-role (null = no growth access)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_sub_role varchar(30)`,

  // audit_logs (RI, append-only)
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(40) NOT NULL,
    entity_type varchar(50),
    entity_id varchar(255),
    reason text,
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id)`,

  // source_channels (IO)
  `CREATE TABLE IF NOT EXISTS source_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type varchar(20) NOT NULL,
    name varchar(255) NOT NULL,
    url text,
    collection_method varchar(20) NOT NULL,
    risk_tier varchar(10) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'proposed',
    robots_tos_notes text,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,

  // demand_clusters (RI) — created before source_jobs (FK-free by design)
  `CREATE TABLE IF NOT EXISTS demand_clusters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_family varchar(50) NOT NULL,
    region_code varchar(30) NOT NULL,
    salary_band varchar(50),
    first_seen timestamptz,
    last_seen timestamptz,
    observation_count integer NOT NULL DEFAULT 0,
    distinct_employer_count integer NOT NULL DEFAULT 0,
    trend varchar(10) NOT NULL DEFAULT 'stable',
    ad_worthy boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS demand_clusters_family_region_idx ON demand_clusters (role_family, region_code)`,

  // source_jobs (RI; raw_text TTL-purged)
  `CREATE TABLE IF NOT EXISTS source_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES source_channels(id) ON DELETE CASCADE,
    observed_at timestamptz NOT NULL,
    role_family varchar(50) NOT NULL,
    role_title_norm varchar(255) NOT NULL,
    region_code varchar(30) NOT NULL,
    city varchar(100),
    employer_name_public varchar(255),
    employer_type varchar(20) NOT NULL DEFAULT 'unknown',
    salary_min numeric(10,2),
    salary_max numeric(10,2),
    salary_unit varchar(10),
    shift_tags text[] NOT NULL DEFAULT '{}',
    requirement_flags text[] NOT NULL DEFAULT '{}',
    urgency_score integer NOT NULL DEFAULT 0,
    source_ref text,
    raw_text text,
    raw_text_expires_at timestamptz,
    extraction_confidence numeric(3,2),
    needs_review boolean NOT NULL DEFAULT false,
    review_resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    review_resolved_at timestamptz,
    dedup_hash varchar(64) NOT NULL,
    cluster_id uuid,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS source_jobs_dedup_idx ON source_jobs (dedup_hash)`,
  `CREATE INDEX IF NOT EXISTS source_jobs_demand_idx ON source_jobs (role_family, region_code, observed_at)`,
  `CREATE INDEX IF NOT EXISTS source_jobs_purge_idx ON source_jobs (raw_text_expires_at)`,

  // employer_targets (RI hard-rule)
  `CREATE TABLE IF NOT EXISTS employer_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    sector varchar(100),
    region_codes text[] NOT NULL DEFAULT '{}',
    observation_count integer NOT NULL DEFAULT 0,
    career_page_url text,
    authorization_status varchar(20) NOT NULL DEFAULT 'none',
    contact_notes text,
    priority_score integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,

  // demand_cluster_employers (RI, M:N)
  `CREATE TABLE IF NOT EXISTS demand_cluster_employers (
    cluster_id uuid NOT NULL REFERENCES demand_clusters(id) ON DELETE CASCADE,
    employer_target_id uuid NOT NULL REFERENCES employer_targets(id) ON DELETE CASCADE,
    PRIMARY KEY (cluster_id, employer_target_id)
  )`,

  // ad_briefs (RI) — gate between clusters and drafting
  `CREATE TABLE IF NOT EXISTS ad_briefs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id uuid NOT NULL REFERENCES demand_clusters(id) ON DELETE CASCADE,
    evidence jsonb,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
    decided_at timestamptz,
    note text,
    created_at timestamptz DEFAULT now()
  )`,

  // landing_pages (public render = whitelisted fields only)
  `CREATE TABLE IF NOT EXISTS landing_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) NOT NULL UNIQUE,
    role_family varchar(50) NOT NULL,
    region_code varchar(30) NOT NULL,
    headline_he varchar(255) NOT NULL,
    body_he text,
    template varchar(50) NOT NULL DEFAULT 'default',
    form_schema jsonb,
    utm_defaults jsonb,
    gfj_markup_enabled boolean NOT NULL DEFAULT false,
    status varchar(20) NOT NULL DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,

  // joby_ads (IO; server-side transitions only)
  `CREATE TABLE IF NOT EXISTS joby_ads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id uuid NOT NULL REFERENCES demand_clusters(id),
    brief_id uuid NOT NULL REFERENCES ad_briefs(id),
    landing_page_id uuid REFERENCES landing_pages(id) ON DELETE SET NULL,
    headline_he varchar(255) NOT NULL,
    body_he text NOT NULL,
    ad_type varchar(30) NOT NULL DEFAULT 'generic_role',
    employer_target_id uuid REFERENCES employer_targets(id) ON DELETE SET NULL,
    status varchar(30) NOT NULL DEFAULT 'draft',
    version integer NOT NULL DEFAULT 1,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    last_edited_by uuid REFERENCES users(id) ON DELETE SET NULL,
    compliance_checked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    compliance_checked_at timestamptz,
    compliance_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,

  // ad_publications (IO)
  `CREATE TABLE IF NOT EXISTS ad_publications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id uuid NOT NULL REFERENCES joby_ads(id) ON DELETE CASCADE,
    platform varchar(30) NOT NULL,
    external_ref varchar(255),
    published_at timestamptz DEFAULT now(),
    published_by uuid REFERENCES users(id) ON DELETE SET NULL,
    spend_ils numeric(12,2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'live',
    rejection_reason text,
    impressions integer NOT NULL DEFAULT 0,
    clicks integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS ad_publications_platform_idx ON ad_publications (platform, published_at)`,

  // candidates (RPD — regulated personal data; PII lives ONLY here)
  `CREATE TABLE IF NOT EXISTS candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name varchar(255) NOT NULL,
    phone varchar(20) NOT NULL UNIQUE,
    email varchar(255),
    city varchar(100),
    region_code varchar(30),
    cv_file_ref text,
    languages text[] NOT NULL DEFAULT '{}',
    consent_privacy_at timestamptz NOT NULL,
    consent_marketing_at timestamptz,
    source_publication_id uuid REFERENCES ad_publications(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,

  // candidate_submissions (RPD via candidate link; scores RI)
  `CREATE TABLE IF NOT EXISTS candidate_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    publication_id uuid REFERENCES ad_publications(id) ON DELETE SET NULL,
    landing_page_id uuid REFERENCES landing_pages(id) ON DELETE SET NULL,
    role_families text[] NOT NULL DEFAULT '{}',
    availability jsonb,
    experience_notes text,
    quality_score integer,
    completeness_score integer,
    classifier_confidence numeric(3,2),
    review_status varchar(20) NOT NULL DEFAULT 'PENDING',
    submitted_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS candidate_submissions_review_idx ON candidate_submissions (review_status, submitted_at)`,

  // cluster_evidence_snapshots (RI; counts only)
  `CREATE TABLE IF NOT EXISTS cluster_evidence_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id uuid NOT NULL REFERENCES demand_clusters(id) ON DELETE CASCADE,
    week date NOT NULL,
    observations integer NOT NULL DEFAULT 0,
    candidates_matched_count integer NOT NULL DEFAULT 0,
    generated_at timestamptz DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cluster_evidence_week_idx ON cluster_evidence_snapshots (cluster_id, week)`,
];

for (const stmt of statements) {
  const label = stmt.trim().slice(0, 72).replace(/\s+/g, " ");
  try {
    await sql(stmt);
    console.log("✓", label);
  } catch (err) {
    console.error("✗", label);
    console.error(" ", err.message);
    process.exit(1);
  }
}

console.log("\n✅ Growth migration applied (additive-only).");
