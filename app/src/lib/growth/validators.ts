// ============================================================
// Growth Engine — Zod schemas for /api/admin/growth/* requests.
// Kept inside lib/growth/ (module isolation): nothing outside
// the growth module may import from here.
// ============================================================

import { z } from "zod";
import {
  SourceChannelType,
  CollectionMethod,
  RiskTier,
  SourceChannelStatus,
  SalaryUnit,
  ObservedEmployerType,
  GrowthSubRole,
  ROLE_FAMILIES,
  GROWTH_REGIONS,
} from "@/lib/constants";

const roleFamilyKeys = ROLE_FAMILIES.map((r) => r.key) as [string, ...string[]];
const regionKeys = GROWTH_REGIONS.map((r) => r.key) as [string, ...string[]];

export const roleFamilySchema = z.enum(roleFamilyKeys);
export const regionCodeSchema = z.enum(regionKeys);

// --- Sources ---

export const createSourceChannelSchema = z.object({
  type: z.nativeEnum(SourceChannelType),
  name: z.string().min(2).max(255),
  url: z.string().url("כתובת לא תקינה").max(2000).optional().nullable(),
  collection_method: z.nativeEnum(CollectionMethod),
  risk_tier: z.nativeEnum(RiskTier),
  robots_tos_notes: z.string().max(4000).optional().nullable(),
});

export const sourceChannelStatusSchema = z.object({
  status: z.enum([SourceChannelStatus.APPROVED, SourceChannelStatus.PAUSED]),
  note: z.string().max(1000).optional(),
});

export const sourceChannelFilterSchema = z.object({
  status: z.nativeEnum(SourceChannelStatus).optional(),
  type: z.nativeEnum(SourceChannelType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Observations (analyst SOP fields — facts only) ---

export const createObservationSchema = z
  .object({
    channel_id: z.string().uuid(),
    observed_at: z
      .string()
      .refine((s) => !isNaN(Date.parse(s)), "תאריך תצפית לא תקין"),
    role_family: roleFamilySchema,
    role_title_norm: z.string().min(2).max(255),
    region_code: regionCodeSchema,
    city: z.string().max(100).optional().nullable(),
    employer_name_public: z.string().max(255).optional().nullable(),
    employer_type: z.nativeEnum(ObservedEmployerType).default("unknown"),
    salary_min: z.number().positive().max(100000).optional().nullable(),
    salary_max: z.number().positive().max(100000).optional().nullable(),
    salary_unit: z.nativeEnum(SalaryUnit).optional().nullable(),
    shift_tags: z.array(z.string().max(50)).max(10).default([]),
    requirement_flags: z.array(z.string().max(50)).max(10).default([]),
    urgency_score: z.number().int().min(0).max(10).default(0),
    source_ref: z.string().max(2000).optional().nullable(),
    // Ephemeral: server sets raw_text_expires_at = now + RAW_TEXT_TTL_DAYS
    raw_text: z.string().max(20000).optional().nullable(),
  })
  .refine(
    (d) =>
      d.salary_min == null || d.salary_max == null || d.salary_max >= d.salary_min,
    { message: "טווח שכר לא תקין", path: ["salary_max"] }
  );

export const updateObservationSchema = z.object({
  role_family: roleFamilySchema.optional(),
  role_title_norm: z.string().min(2).max(255).optional(),
  region_code: regionCodeSchema.optional(),
  city: z.string().max(100).optional().nullable(),
  employer_name_public: z.string().max(255).optional().nullable(),
  employer_type: z.nativeEnum(ObservedEmployerType).optional(),
  salary_min: z.number().positive().max(100000).optional().nullable(),
  salary_max: z.number().positive().max(100000).optional().nullable(),
  salary_unit: z.nativeEnum(SalaryUnit).optional().nullable(),
  shift_tags: z.array(z.string().max(50)).max(10).optional(),
  requirement_flags: z.array(z.string().max(50)).max(10).optional(),
  urgency_score: z.number().int().min(0).max(10).optional(),
  resolve_review: z.boolean().optional(),
});

export const observationFilterSchema = z.object({
  channel_id: z.string().uuid().optional(),
  role_family: roleFamilySchema.optional(),
  region_code: regionCodeSchema.optional(),
  needs_review: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Public intake (the ONLY public write surface) ---

const IL_PHONE_RE = /^(\+972|0)5\d{8}$/;

export const publicIntakeSchema = z.object({
  full_name: z.string().min(2, "שם מלא נדרש").max(255),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(IL_PHONE_RE, "מספר טלפון נייד לא תקין")),
  city: z.string().min(2, "עיר נדרשת").max(100),
  role_families: z.array(roleFamilySchema).min(1, "בחרו תחום אחד לפחות").max(5),
  shifts: z.array(z.enum(["morning", "evening", "night", "weekend"])).max(4).default([]),
  experience: z.enum(["none", "lt1", "1to3", "gt3"]).optional(),
  consent_privacy: z.literal(true, {
    errorMap: () => ({ message: "נדרשת הסכמה למדיניות הפרטיות" }),
  }),
  consent_marketing: z.boolean().default(false),
  landing_page_slug: z.string().min(1).max(100),
  // Honeypot — humans never fill this; bots do. Non-empty → silent drop.
  website: z.string().max(200).optional().default(""),
});
export type PublicIntakeInput = z.infer<typeof publicIntakeSchema>;

// --- Intake review queue (admin) ---

export const intakeFilterSchema = z.object({
  review_status: z.enum(["PENDING", "REVIEWED", "FLAGGED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const intakeReviewSchema = z.object({
  review_status: z.enum(["REVIEWED", "FLAGGED"]),
  role_families: z.array(roleFamilySchema).min(1).max(5).optional(),
  quality_score: z.number().int().min(0).max(100).optional(),
});

export const unmaskSchema = z.object({
  reason: z.string().min(5, "נדרש נימוק לחשיפת פרטים").max(500),
});

// --- Roles (super_admin only) ---

export const growthRoleSchema = z.object({
  user_id: z.string().uuid(),
  sub_role: z.nativeEnum(GrowthSubRole),
});

export const growthRoleRevokeSchema = z.object({
  user_id: z.string().uuid(),
});

// --- Audit ---

export const auditFilterSchema = z.object({
  action: z.string().max(40).optional(),
  entity_type: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
