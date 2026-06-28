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
  batch_id: varchar("batch_id", { length: 100 }),
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
