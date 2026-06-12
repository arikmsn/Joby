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
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  logo_url: text("logo_url"),
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
