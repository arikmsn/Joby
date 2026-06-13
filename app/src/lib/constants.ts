// ============================================================
// Joby — Single source of truth for all constants
// ============================================================

// --- Shift Status ---
export const ShiftStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

// --- Application Status ---
export const ApplicationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CONFIRMED: "CONFIRMED",
  UNCONFIRMED: "UNCONFIRMED",
  CANCELLED_BY_WORKER: "CANCELLED_BY_WORKER",
  CANCELLED_BY_SYSTEM: "CANCELLED_BY_SYSTEM",
  CHECKED_IN: "CHECKED_IN",
  CHECKED_OUT: "CHECKED_OUT",
  NO_SHOW: "NO_SHOW",
  RATED: "RATED",
} as const;
export type ApplicationStatus =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

// Terminal statuses — no further transitions allowed
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.REJECTED,
  ApplicationStatus.CANCELLED_BY_WORKER,
  ApplicationStatus.CANCELLED_BY_SYSTEM,
  ApplicationStatus.NO_SHOW,
  ApplicationStatus.RATED,
];

// Statuses that count toward slots_filled
export const SLOT_COUNTED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPROVED,
  ApplicationStatus.CONFIRMED,
  ApplicationStatus.CHECKED_IN,
  ApplicationStatus.CHECKED_OUT,
  ApplicationStatus.RATED,
];

// --- SOS Status ---
export const SOSStatus = {
  INACTIVE: "INACTIVE",
  ACTIVE: "ACTIVE",
  FILLED: "FILLED",
  EXPIRED: "EXPIRED",
} as const;
export type SOSStatus = (typeof SOSStatus)[keyof typeof SOSStatus];

// --- Incident Type ---
export const IncidentType = {
  NO_SHOW: "NO_SHOW",
  LOW_TRUST: "LOW_TRUST",
  QR_FAILURE: "QR_FAILURE",
  SHIFT_UNFILLED: "SHIFT_UNFILLED",
  EMPLOYER_COMPLAINT: "EMPLOYER_COMPLAINT",
  WORKER_COMPLAINT: "WORKER_COMPLAINT",
  MANUAL_REVIEW: "MANUAL_REVIEW",
} as const;
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

// --- Incident Severity ---
export const IncidentSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type IncidentSeverity =
  (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

// --- Incident Status ---
export const IncidentStatus = {
  OPEN: "OPEN",
  IN_REVIEW: "IN_REVIEW",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type IncidentStatus =
  (typeof IncidentStatus)[keyof typeof IncidentStatus];

// --- Check Mode ---
export const CheckMode = {
  CHECK_IN: "CHECK_IN",
  CHECK_OUT: "CHECK_OUT",
} as const;
export type CheckMode = (typeof CheckMode)[keyof typeof CheckMode];

// --- Checkin Source ---
export const CheckinSource = {
  QR: "QR",
  MANUAL: "MANUAL",
} as const;
export type CheckinSource = (typeof CheckinSource)[keyof typeof CheckinSource];

// --- User Role ---
export const UserRole = {
  EMPLOYER: "employer",
  WORKER: "worker",
  ADMIN: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// --- Pay Type ---
export const PayType = {
  HOURLY: "hourly",
  FIXED: "fixed",
} as const;
export type PayType = (typeof PayType)[keyof typeof PayType];

// --- Notification Channel ---
export const NotificationChannel = {
  IN_APP: "in_app",
  SMS: "sms",
  PUSH: "push",
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

// --- Configuration ---
export const Config = {
  // Trust
  TRUST_BASE_SCORE: 5.0,
  TRUST_NEW_WORKER_FLOOR: 4.0,
  TRUST_NEW_WORKER_SHIFT_THRESHOLD: 3, // first N completed shifts
  TRUST_LOW_THRESHOLD: 1.5, // auto-flag for review
  TRUST_SOS_FLOOR: 3.0,

  // Timing defaults
  DEFAULT_CONFIRMATION_WINDOW_HOURS: 12,
  DEFAULT_CHECKIN_GRACE_MINUTES: 15,
  DEFAULT_CHECKOUT_GRACE_MINUTES: 30,
  UNCONFIRMED_CUTOFF_HOURS: 2,

  // QR
  QR_TOKEN_TTL_MINUTES: 5,

  // OTP
  OTP_LENGTH: 6,
  OTP_RATE_LIMIT_PER_HOUR: 3,
  OTP_EXPIRY_MINUTES: 10,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
