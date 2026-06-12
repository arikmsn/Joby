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
    min_trust_score: z.number().min(0).max(5).optional(),
  });

export const shiftStatusSchema = z.object({
  status: z.enum(["PUBLISHED", "CANCELLED"]),
});

export const shiftFilterSchema = z.object({
  role_tag: z.string().optional(),
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
