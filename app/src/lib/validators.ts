// ============================================================
// Joby — Zod validation schemas for API requests
// ============================================================

import { z } from "zod";
import { UserRole } from "./constants";

// --- Auth ---

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/, "מספר טלפון לא תקין"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(9).max(15).regex(/^\+?[0-9]+$/),
  otp: z.string().length(6),
});

export const registerSchema = z
  .object({
    full_name: z.string().min(2).max(255),
    role: z.enum([UserRole.EMPLOYER, UserRole.WORKER]),
    business_name: z.string().min(2).max(255).optional(),
    business_type: z.string().max(100).optional(),
    address: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    city: z.string().max(100).optional(),
    experience_tags: z.array(z.string()).optional(),
    date_of_birth: z.string().optional(),
    bio: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.role === UserRole.EMPLOYER) return !!data.business_name;
      return true;
    },
    { message: "שם העסק נדרש למעסיקים", path: ["business_name"] }
  );

// --- Shifts ---

export const createShiftSchema = z
  .object({
    title: z.string().min(2, "שם המשמרת נדרש").max(255),
    role_tag: z.string().min(1, "תפקיד נדרש").max(100),
    description: z.string().max(2000).optional(),
    location_name: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    address: z.string().min(1, "כתובת נדרשת"),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    start_at: z.string().refine((s) => !isNaN(Date.parse(s)), "תאריך התחלה לא תקין"),
    end_at: z.string().refine((s) => !isNaN(Date.parse(s)), "תאריך סיום לא תקין"),
    pay_rate: z.number().positive("שכר חייב להיות חיובי"),
    pay_type: z.enum(["hourly", "fixed"]).default("hourly"),
    workers_needed: z.number().int().min(1, "מספר עובדים נדרש").default(1),
    dress_code: z.string().max(500).optional(),
    gear_required: z.string().max(500).optional(),
    arrival_notes: z.string().max(500).optional(),
    contact_name: z.string().max(255).optional(),
    contact_phone: z.string().max(20).optional(),
    requirements_ack: z.string().max(1000).optional(),
    min_trust_score: z.number().min(0).max(5).default(0),
    publish: z.boolean().default(false),
  })
  .refine((data) => new Date(data.end_at) > new Date(data.start_at), {
    message: "שעת סיום חייבת להיות אחרי שעת התחלה",
    path: ["end_at"],
  });

export const updateShiftSchema = z
  .object({
    title: z.string().min(2).max(255).optional(),
    role_tag: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    location_name: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    address: z.string().min(1).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    start_at: z.string().refine((s) => !isNaN(Date.parse(s)), "תאריך לא תקין").optional(),
    end_at: z.string().refine((s) => !isNaN(Date.parse(s)), "תאריך לא תקין").optional(),
    pay_rate: z.number().positive().optional(),
    pay_type: z.enum(["hourly", "fixed"]).optional(),
    workers_needed: z.number().int().min(1).optional(),
    dress_code: z.string().max(500).optional(),
    gear_required: z.string().max(500).optional(),
    arrival_notes: z.string().max(500).optional(),
    contact_name: z.string().max(255).optional(),
    contact_phone: z.string().max(20).optional(),
    requirements_ack: z.string().max(1000).optional(),
    min_trust_score: z.number().min(0).max(5).optional(),
  });

export const shiftStatusSchema = z.object({
  status: z.enum(["PUBLISHED", "CANCELLED"]),
});

export const shiftFilterSchema = z.object({
  role_tag: z.string().optional(),
  role_tags: z.string().optional(),
  city: z.string().optional(),
  date: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Applications (Sprint 3) ---

export const approveApplicationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  is_backup: z.boolean().default(false),
});

export const rateWorkerSchema = z.object({
  score: z.number().int().min(1).max(5),
  flag: z.string().max(50).optional(),
  comment: z.string().max(500).optional(),
});

// --- Pagination ---

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Admin ---

export const adminListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminCreateEmployerSchema = z.object({
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/, "מספר טלפון לא תקין"),
  full_name: z.string().min(2).max(255),
  business_name: z.string().min(2).max(255),
  business_type: z.string().max(100).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
});

export const adminUpdateEmployerSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  business_name: z.string().min(2).max(255).optional(),
  business_type: z.string().max(100).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
});

export const adminCreateWorkerSchema = z.object({
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/, "מספר טלפון לא תקין"),
  full_name: z.string().min(2).max(255),
  city: z.string().max(100).optional(),
  experience_tags: z.array(z.string()).optional(),
  bio: z.string().max(500).optional(),
});

export const adminUpdateWorkerSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  city: z.string().max(100).optional(),
  experience_tags: z.array(z.string()).optional(),
  bio: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

export const adminCreateShiftSchema = createShiftSchema.and(
  z.object({ employer_id: z.string().uuid("מעסיק נדרש") })
);

export const adminShiftFilterSchema = z.object({
  status: z.string().optional(),
  employer_id: z.string().uuid().optional(),
  date: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Profiles ---

export const updateWorkerMeSchema = z.object({
  experience_tags: z.array(z.string()).optional(),
  preferred_cities: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  has_vehicle: z.boolean().optional(),
  has_license: z.boolean().optional(),
  license_types: z.array(z.string()).optional(),
  vehicle_types: z.array(z.string()).optional(),
  min_pay: z.number().min(0).max(1000).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  onboarding_completed: z.boolean().optional(),
  onboarding_skipped: z.boolean().optional(),
  reminders_enabled: z.boolean().optional(),
});

export const updateEmployerMeSchema = z.object({
  business_name: z.string().min(2).max(255).optional(),
  business_type: z.string().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  contact_phone: z.string().max(20).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
});

export const adminCreateOccupationSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "מפתח חייב להיות אנגלית קטנה, מספרים ומקפים בלבד"),
  label_he: z.string().min(1).max(100),
  sort_order: z.number().int().optional(),
});

export const adminUpdateOccupationSchema = z.object({
  label_he: z.string().min(1).max(100).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export const adminIncidentFilterSchema = z.object({
  status: z.string().optional(),
  incident_type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUpdateIncidentSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]),
  resolution_notes: z.string().max(2000).optional(),
});

// --- Known Workers / Invites (Sprint 6) ---

export const togglePreferredWorkerSchema = z.object({
  is_preferred: z.boolean(),
});

export const inviteWorkerSchema = z.object({
  worker_id: z.string().uuid(),
  shift_id: z.string().uuid(),
});

export const workerSearchByPhoneSchema = z.object({
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/, "מספר טלפון לא תקין"),
});

export const inviteNewWorkerSchema = z.object({
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/, "מספר טלפון לא תקין"),
});

export const referFriendSchema = z.object({
  phone: z
    .string()
    .min(9)
    .max(15)
    .regex(/^\+?[0-9]+$/, "מספר טלפון לא תקין"),
});

// --- Payment status (Sprint 6, admin) ---

export const updatePaymentStatusSchema = z.object({
  payment_status: z.enum(["APPROVED_FOR_PAYMENT", "PAID"]),
});

// --- Worker payout details (Sprint 6) ---

export const updatePayoutDetailsSchema = z.object({
  payout_legal_name: z.string().max(255).nullable().optional(),
  payout_id_number: z.string().max(50).nullable().optional(),
  payout_bank_name: z.string().max(100).nullable().optional(),
  payout_bank_branch: z.string().max(20).nullable().optional(),
  payout_account_number: z.string().max(50).nullable().optional(),
  payout_account_holder: z.string().max(255).nullable().optional(),
});

// --- Reports range (Sprint 6) ---

export const reportRangeSchema = z.object({
  range: z.enum(["today", "week", "month"]).default("today"),
});

// Type exports
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type ShiftStatusInput = z.infer<typeof shiftStatusSchema>;
export type ShiftFilterInput = z.infer<typeof shiftFilterSchema>;
export type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>;
export type RateWorkerInput = z.infer<typeof rateWorkerSchema>;
