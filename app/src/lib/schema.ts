// ============================================================
// Joby — Drizzle ORM schema (mirrors migrations)
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  integer,
  date,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// --- Users ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: varchar("phone", { length: 20 }).unique().notNull(),
  email: varchar("email", { length: 255 }),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  avatar_url: text("avatar_url"),
  is_active: boolean("is_active").default(true),
  created_by_admin: boolean("created_by_admin").notNull().default(false),
  // Growth module sub-role (null = no growth access; see GrowthSubRole)
  admin_sub_role: varchar("admin_sub_role", { length: 30 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Employer Profiles ---

export const employerProfiles = pgTable("employer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .unique()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  business_name: varchar("business_name", { length: 255 }).notNull(),
  business_type: varchar("business_type", { length: 100 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  logo_url: text("logo_url"),
  contact_phone: varchar("contact_phone", { length: 20 }),
  description: text("description"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Worker Profiles ---

export const workerProfiles = pgTable("worker_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .unique()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date_of_birth: date("date_of_birth"),
  city: varchar("city", { length: 100 }),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  experience_tags: text("experience_tags").array(),
  bio: text("bio"),
  trust_score: decimal("trust_score", { precision: 3, scale: 2 }).default(
    "5.00"
  ),
  total_shifts: integer("total_shifts").default(0),
  no_show_count: integer("no_show_count").default(0),
  cancel_count: integer("cancel_count").default(0),
  late_cancel_count: integer("late_cancel_count").notNull().default(0),
  preferred_cities: text("preferred_cities").array().notNull().default([]),
  languages: text("languages").array().notNull().default([]),
  has_vehicle: boolean("has_vehicle").notNull().default(false),
  has_license: boolean("has_license").notNull().default(false),
  license_types: text("license_types").array().notNull().default([]),
  vehicle_types: text("vehicle_types").array().notNull().default([]),
  min_pay: decimal("min_pay", { precision: 10, scale: 2 }),
  onboarding_completed_at: timestamp("onboarding_completed_at", { withTimezone: true }),
  onboarding_skipped_at: timestamp("onboarding_skipped_at", { withTimezone: true }),
  payout_legal_name: varchar("payout_legal_name", { length: 255 }),
  payout_id_number: varchar("payout_id_number", { length: 50 }),
  payout_bank_name: varchar("payout_bank_name", { length: 100 }),
  payout_bank_branch: varchar("payout_bank_branch", { length: 20 }),
  payout_account_number: varchar("payout_account_number", { length: 50 }),
  payout_account_holder: varchar("payout_account_holder", { length: 255 }),
  payout_details_completed_at: timestamp("payout_details_completed_at", { withTimezone: true }),
  supplier_type: varchar("supplier_type", { length: 30 }),
  tax_id: varchar("tax_id", { length: 50 }),
  payout_ready: boolean("payout_ready").notNull().default(false),
  reminders_enabled: boolean("reminders_enabled").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Shifts ---

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  employer_id: uuid("employer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  role_tag: varchar("role_tag", { length: 100 }).notNull(),
  description: text("description"),
  location_name: varchar("location_name", { length: 255 }),
  city: varchar("city", { length: 100 }),
  address: text("address").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  start_at: timestamp("start_at", { withTimezone: true }).notNull(),
  end_at: timestamp("end_at", { withTimezone: true }).notNull(),
  pay_rate: decimal("pay_rate", { precision: 10, scale: 2 }).notNull(),
  pay_type: varchar("pay_type", { length: 20 }).notNull().default("hourly"),
  workers_needed: integer("workers_needed").notNull().default(1),
  slots_filled: integer("slots_filled").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
  dress_code: text("dress_code"),
  gear_required: text("gear_required"),
  arrival_notes: text("arrival_notes"),
  contact_name: varchar("contact_name", { length: 255 }),
  contact_phone: varchar("contact_phone", { length: 20 }),
  requirements_ack: text("requirements_ack"),
  min_trust_score: decimal("min_trust_score", { precision: 3, scale: 2 }).default("0.00"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Applications ---
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  shift_id: uuid("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  worker_id: uuid("worker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 30 }).notNull().default("PENDING"),
  is_backup: boolean("is_backup").notNull().default(false),
  payment_status: varchar("payment_status", { length: 30 }).notNull().default("PENDING"),
  approved_for_payment_at: timestamp("approved_for_payment_at", { withTimezone: true }),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  applied_at: timestamp("applied_at", { withTimezone: true }).defaultNow(),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  rejected_at: timestamp("rejected_at", { withTimezone: true }),
  cancelled_at: timestamp("cancelled_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Checkin Events ---
export const checkinEvents = pgTable("checkin_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  application_id: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  event_type: varchar("event_type", { length: 20 }).notNull(),
  source: varchar("source", { length: 20 }).notNull(),
  scanned_by_user_id: uuid("scanned_by_user_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- SOS Broadcasts ---
export const sosBroadcasts = pgTable("sos_broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  shift_id: uuid("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  employer_id: uuid("employer_id").notNull().references(() => users.id),
  slots_needed: integer("slots_needed").notNull().default(1),
  sent_to_count: integer("sent_to_count").notNull().default(0),
  filled_count: integer("filled_count").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expires_at: timestamp("expires_at", { withTimezone: true }),
});

// --- Ratings ---
export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  application_id: uuid("application_id").notNull().unique().references(() => applications.id, { onDelete: "cascade" }),
  shift_id: uuid("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  worker_id: uuid("worker_id").notNull().references(() => users.id),
  employer_id: uuid("employer_id").notNull().references(() => users.id),
  score: integer("score").notNull(),
  flag: varchar("flag", { length: 50 }),
  comment: text("comment"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Occupation Catalog ---
export const occupationCatalog = pgTable("occupation_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 50 }).unique().notNull(),
  label_he: varchar("label_he", { length: 100 }).notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Incidents ---
export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  incident_type: varchar("incident_type", { length: 30 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("MEDIUM"),
  status: varchar("status", { length: 20 }).notNull().default("OPEN"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  related_user_id: uuid("related_user_id").references(() => users.id, { onDelete: "set null" }),
  related_shift_id: uuid("related_shift_id").references(() => shifts.id, { onDelete: "set null" }),
  related_application_id: uuid("related_application_id").references(() => applications.id, { onDelete: "set null" }),
  created_by_user_id: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  assigned_admin_id: uuid("assigned_admin_id").references(() => users.id, { onDelete: "set null" }),
  resolution_notes: text("resolution_notes"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
});

// --- Employer/Worker Relations (known workers) ---
export const employerWorkerRelations = pgTable("employer_worker_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  employer_id: uuid("employer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  worker_id: uuid("worker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  is_preferred: boolean("is_preferred").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Worker Invites (employer invites a phone number not yet on Joby) ---
export const workerInvites = pgTable("worker_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  employer_id: uuid("employer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  invited_by_user_id: uuid("invited_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  invited_phone: varchar("invited_phone", { length: 20 }).notNull(),
  normalized_phone: varchar("normalized_phone", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  sent_at: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  joined_at: timestamp("joined_at", { withTimezone: true }),
  message_provider: varchar("message_provider", { length: 50 }),
  provider_message_id: varchar("provider_message_id", { length: 100 }),
  last_error: text("last_error"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Notifications ---
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  payload: jsonb("payload"),
  channel: varchar("channel", { length: 20 }).notNull().default("in_app"),
  is_read: boolean("is_read").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Payout Batches ---
export const payoutBatches = pgTable("payout_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  batch_date: date("batch_date").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("PREPARED"),
  items_count: integer("items_count").notNull().default(0),
  total_gross: decimal("total_gross", { precision: 12, scale: 2 }).notNull().default("0"),
  total_fees: decimal("total_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  total_net: decimal("total_net", { precision: 12, scale: 2 }).notNull().default("0"),
  warnings_count: integer("warnings_count").notNull().default(0),
  prepared_by: uuid("prepared_by").references(() => users.id),
  notes: text("notes"),
  provider_name: varchar("provider_name", { length: 50 }),
  provider_batch_id: varchar("provider_batch_id", { length: 255 }),
  provider_status: varchar("provider_status", { length: 50 }),
  provider_message: text("provider_message"),
  submitted_at: timestamp("submitted_at", { withTimezone: true }),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true }),
  failed_at: timestamp("failed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  transferred_at: timestamp("transferred_at", { withTimezone: true }),
});

// --- Payout Ledger ---
export const payoutLedger = pgTable("payout_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  worker_id: uuid("worker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  application_id: uuid("application_id").notNull().references(() => applications.id),
  shift_id: uuid("shift_id").notNull().references(() => shifts.id),
  gross_amount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  platform_fee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  net_amount: decimal("net_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  batch_id: uuid("batch_id").references(() => payoutBatches.id),
  calculation: jsonb("calculation"),
  provider_transfer_id: varchar("provider_transfer_id", { length: 255 }),
  provider_status: varchar("provider_status", { length: 50 }),
  provider_message: text("provider_message"),
  submitted_at: timestamp("submitted_at", { withTimezone: true }),
  failed_at: timestamp("failed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  transferred_at: timestamp("transferred_at", { withTimezone: true }),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true }),
});

// ── OTP tables (DB-backed OTP store for serverless) ──────────

export const otpCodes = pgTable("otp_codes", {
  phone: varchar("phone", { length: 20 }).primaryKey(),
  otp: varchar("otp", { length: 10 }).notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const otpRateLimits = pgTable("otp_rate_limits", {
  phone: varchar("phone", { length: 20 }).primaryKey(),
  count: integer("count").notNull().default(1),
  reset_at: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// ============================================================
// Growth Engine (admin-only module)
// Data classes — IO: internal operational · RI: restricted internal ·
// RPD: regulated personal data (PII isolated to `candidates`).
// Access ONLY via lib/growth/* repositories behind withGrowthAuth.
// ============================================================

// --- Audit log (RI, append-only: no update/delete path anywhere) ---
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actor_id: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 40 }).notNull(),
    entity_type: varchar("entity_type", { length: 50 }),
    // ids/paths only — never PII values
    entity_id: varchar("entity_id", { length: 255 }),
    reason: text("reason"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    actorIdx: index("audit_logs_actor_idx").on(t.actor_id, t.created_at),
    entityIdx: index("audit_logs_entity_idx").on(t.entity_type, t.entity_id),
  })
);

// --- Source channels (IO) — collection gate: nothing is collected from non-approved channels ---
export const sourceChannels = pgTable("source_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url"),
  collection_method: varchar("collection_method", { length: 20 }).notNull(),
  risk_tier: varchar("risk_tier", { length: 10 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("proposed"),
  robots_tos_notes: text("robots_tos_notes"),
  created_by: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  approved_by: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  // last successful collector visit (also set on zero-yield runs) — drives freshness
  last_collected_at: timestamp("last_collected_at", { withTimezone: true }),
  last_collect_error: text("last_collect_error"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Source jobs / observations (RI) — facts only; raw_text auto-purged ≤30d ---
export const sourceJobs = pgTable(
  "source_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel_id: uuid("channel_id")
      .notNull()
      .references(() => sourceChannels.id, { onDelete: "cascade" }),
    observed_at: timestamp("observed_at", { withTimezone: true }).notNull(),
    role_family: varchar("role_family", { length: 50 }).notNull(),
    role_title_norm: varchar("role_title_norm", { length: 255 }).notNull(),
    region_code: varchar("region_code", { length: 30 }).notNull(),
    city: varchar("city", { length: 100 }),
    employer_name_public: varchar("employer_name_public", { length: 255 }),
    employer_type: varchar("employer_type", { length: 20 }).notNull().default("unknown"),
    salary_min: decimal("salary_min", { precision: 10, scale: 2 }),
    salary_max: decimal("salary_max", { precision: 10, scale: 2 }),
    salary_unit: varchar("salary_unit", { length: 10 }),
    shift_tags: text("shift_tags").array().notNull().default([]),
    requirement_flags: text("requirement_flags").array().notNull().default([]),
    urgency_score: integer("urgency_score").notNull().default(0),
    source_ref: text("source_ref"),
    raw_text: text("raw_text"),
    raw_text_expires_at: timestamp("raw_text_expires_at", { withTimezone: true }),
    extraction_confidence: decimal("extraction_confidence", { precision: 3, scale: 2 }),
    needs_review: boolean("needs_review").notNull().default(false),
    review_resolved_by: uuid("review_resolved_by").references(() => users.id, { onDelete: "set null" }),
    review_resolved_at: timestamp("review_resolved_at", { withTimezone: true }),
    dedup_hash: varchar("dedup_hash", { length: 64 }).notNull(),
    cluster_id: uuid("cluster_id"),
    created_by: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    dedupIdx: uniqueIndex("source_jobs_dedup_idx").on(t.dedup_hash),
    demandIdx: index("source_jobs_demand_idx").on(t.role_family, t.region_code, t.observed_at),
    purgeIdx: index("source_jobs_purge_idx").on(t.raw_text_expires_at),
  })
);

// --- Demand clusters (RI) — ad_worthy is job-computed only; no API write path ---
export const demandClusters = pgTable(
  "demand_clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role_family: varchar("role_family", { length: 50 }).notNull(),
    region_code: varchar("region_code", { length: 30 }).notNull(),
    salary_band: varchar("salary_band", { length: 50 }),
    first_seen: timestamp("first_seen", { withTimezone: true }),
    last_seen: timestamp("last_seen", { withTimezone: true }),
    observation_count: integer("observation_count").notNull().default(0),
    distinct_employer_count: integer("distinct_employer_count").notNull().default(0),
    trend: varchar("trend", { length: 10 }).notNull().default("stable"),
    // rule: observation_count >= 5 AND distinct_employer_count >= 3
    ad_worthy: boolean("ad_worthy").notNull().default(false),
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    familyRegionIdx: index("demand_clusters_family_region_idx").on(t.role_family, t.region_code),
  })
);

// --- Employer targets (RI hard-rule: never any employer-facing exposure) ---
export const employerTargets = pgTable("employer_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  sector: varchar("sector", { length: 100 }),
  region_codes: text("region_codes").array().notNull().default([]),
  observation_count: integer("observation_count").notNull().default(0),
  career_page_url: text("career_page_url"),
  authorization_status: varchar("authorization_status", { length: 20 }).notNull().default("none"),
  contact_notes: text("contact_notes"),
  priority_score: integer("priority_score").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Cluster ↔ employer evidence (RI) ---
export const demandClusterEmployers = pgTable(
  "demand_cluster_employers",
  {
    cluster_id: uuid("cluster_id")
      .notNull()
      .references(() => demandClusters.id, { onDelete: "cascade" }),
    employer_target_id: uuid("employer_target_id")
      .notNull()
      .references(() => employerTargets.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.cluster_id, t.employer_target_id] }),
  })
);

// --- Ad briefs (RI) — the gate between clusters and ad drafting ---
export const adBriefs = pgTable("ad_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  cluster_id: uuid("cluster_id")
    .notNull()
    .references(() => demandClusters.id, { onDelete: "cascade" }),
  evidence: jsonb("evidence"), // counts only, no source text
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  decided_by: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decided_at: timestamp("decided_at", { withTimezone: true }),
  note: text("note"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Landing pages (public render = whitelisted fields ONLY: slug, headline_he, body_he, form_schema) ---
export const landingPages = pgTable("landing_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  role_family: varchar("role_family", { length: 50 }).notNull(),
  region_code: varchar("region_code", { length: 30 }).notNull(),
  headline_he: varchar("headline_he", { length: 255 }).notNull(),
  body_he: text("body_he"),
  template: varchar("template", { length: 50 }).notNull().default("default"),
  form_schema: jsonb("form_schema"),
  utm_defaults: jsonb("utm_defaults"),
  gfj_markup_enabled: boolean("gfj_markup_enabled").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Joby ads (IO; drafts RI-lite). Status transitions server-side only. ---
export const jobyAds = pgTable("joby_ads", {
  id: uuid("id").primaryKey().defaultRandom(),
  cluster_id: uuid("cluster_id")
    .notNull()
    .references(() => demandClusters.id),
  brief_id: uuid("brief_id")
    .notNull()
    .references(() => adBriefs.id),
  landing_page_id: uuid("landing_page_id").references(() => landingPages.id, { onDelete: "set null" }),
  headline_he: varchar("headline_he", { length: 255 }).notNull(),
  body_he: text("body_he").notNull(),
  ad_type: varchar("ad_type", { length: 30 }).notNull().default("generic_role"),
  // settable only when employer_targets.authorization_status = 'authorized'
  employer_target_id: uuid("employer_target_id").references(() => employerTargets.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  created_by: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  last_edited_by: uuid("last_edited_by").references(() => users.id, { onDelete: "set null" }),
  compliance_checked_by: uuid("compliance_checked_by").references(() => users.id, { onDelete: "set null" }),
  compliance_checked_at: timestamp("compliance_checked_at", { withTimezone: true }),
  compliance_notes: text("compliance_notes"), // RI — visible to compliance + super_admin only
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Ad publications (IO) — every external publish is a recorded human action ---
export const adPublications = pgTable(
  "ad_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ad_id: uuid("ad_id")
      .notNull()
      .references(() => jobyAds.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 30 }).notNull(),
    external_ref: varchar("external_ref", { length: 255 }),
    published_at: timestamp("published_at", { withTimezone: true }).defaultNow(),
    published_by: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    spend_ils: decimal("spend_ils", { precision: 12, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 20 }).notNull().default("live"),
    rejection_reason: text("rejection_reason"),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    platformIdx: index("ad_publications_platform_idx").on(t.platform, t.published_at),
  })
);

// --- Candidates (RPD ⚖️ — regulated database; PII lives ONLY here.
//     Masked DTOs by default; unmask requires growth:candidates.pii + audit.) ---
export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).unique().notNull(),
  email: varchar("email", { length: 255 }),
  city: varchar("city", { length: 100 }),
  region_code: varchar("region_code", { length: 30 }),
  cv_file_ref: text("cv_file_ref"),
  languages: text("languages").array().notNull().default([]),
  consent_privacy_at: timestamp("consent_privacy_at", { withTimezone: true }).notNull(),
  consent_marketing_at: timestamp("consent_marketing_at", { withTimezone: true }),
  source_publication_id: uuid("source_publication_id").references(() => adPublications.id, { onDelete: "set null" }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// --- Candidate submissions (RPD via candidate link; scores RI) ---
export const candidateSubmissions = pgTable(
  "candidate_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidate_id: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    publication_id: uuid("publication_id").references(() => adPublications.id, { onDelete: "set null" }),
    landing_page_id: uuid("landing_page_id").references(() => landingPages.id, { onDelete: "set null" }),
    role_families: text("role_families").array().notNull().default([]),
    availability: jsonb("availability"),
    experience_notes: text("experience_notes"), // may contain PII — treated as RPD
    quality_score: integer("quality_score"),
    completeness_score: integer("completeness_score"),
    classifier_confidence: decimal("classifier_confidence", { precision: 3, scale: 2 }),
    review_status: varchar("review_status", { length: 20 }).notNull().default("PENDING"),
    submitted_at: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    reviewIdx: index("candidate_submissions_review_idx").on(t.review_status, t.submitted_at),
  })
);

// --- Intake rate limits (public endpoint hardening; keys are salted hashes,
//     never raw IPs/phones — log-hygiene by construction) ---
export const intakeRateLimits = pgTable("intake_rate_limits", {
  key: varchar("key", { length: 80 }).primaryKey(),
  count: integer("count").notNull().default(1),
  reset_at: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// --- Cluster evidence snapshots (RI; counts only, no PII by construction) ---
export const clusterEvidenceSnapshots = pgTable(
  "cluster_evidence_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cluster_id: uuid("cluster_id")
      .notNull()
      .references(() => demandClusters.id, { onDelete: "cascade" }),
    week: date("week").notNull(),
    observations: integer("observations").notNull().default(0),
    candidates_matched_count: integer("candidates_matched_count").notNull().default(0),
    generated_at: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    weekIdx: uniqueIndex("cluster_evidence_week_idx").on(t.cluster_id, t.week),
  })
);
