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

// --- Payment Status (per application) ---
// Tracks the payment lifecycle on the application itself:
//   PENDING → APPROVED_FOR_PAYMENT → PAYABLE → PAYOUT_PENDING → PAID / FAILED
export const PaymentStatus = {
  PENDING: "PENDING",
  APPROVED_FOR_PAYMENT: "APPROVED_FOR_PAYMENT",
  PAYABLE: "PAYABLE",
  PAYOUT_PENDING: "PAYOUT_PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// --- Ledger Item Status ---
// Tracks the transfer lifecycle on each payout_ledger row:
//   PENDING → SUBMITTED → CONFIRMED / FAILED   (+ HELD for blocked items)
export const LedgerStatus = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  HELD: "HELD",
} as const;
export type LedgerStatus = (typeof LedgerStatus)[keyof typeof LedgerStatus];

// --- Batch Status ---
// Tracks batch-level transfer lifecycle:
//   PREPARED → SUBMITTED → CONFIRMED / FAILED / PARTIALLY_CONFIRMED
export const BatchStatus = {
  PREPARED: "PREPARED",
  SUBMITTED: "SUBMITTED",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  PARTIALLY_CONFIRMED: "PARTIALLY_CONFIRMED",
} as const;
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

// Application statuses that represent completed work (eligible for payment/reporting)
export const PAYABLE_STATUSES: ApplicationStatus[] = [
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

// --- Cities (MVP-fixed list for preferences/filters) ---
export const ISRAEL_CITIES = [
  "תל אביב",
  "ירושלים",
  "חיפה",
  "פתח תקווה",
  "רמת גן",
  "הרצליה",
  "חולון",
  "באר שבע",
  "נתניה",
  "ראשון לציון",
] as const;

// --- Languages (MVP-fixed list for worker profile) ---
export const WORKER_LANGUAGES = [
  { key: "he", label_he: "עברית" },
  { key: "en", label_he: "אנגלית" },
  { key: "ar", label_he: "ערבית" },
  { key: "ru", label_he: "רוסית" },
  { key: "fr", label_he: "צרפתית" },
  { key: "es", label_he: "ספרדית" },
  { key: "am", label_he: "אמהרית" },
] as const;

// --- Driver license types (legal license held by worker) ---
export const LICENSE_TYPES = [
  { key: "car", label_he: "רכב פרטי (B)" },
  { key: "motorcycle", label_he: "אופנוע" },
  { key: "truck", label_he: "משאית" },
  { key: "transport", label_he: "הסעת נוסעים" },
  { key: "forklift", label_he: "מלגזה" },
  { key: "other", label_he: "אחר" },
] as const;

// --- Vehicle availability in practice (separate from legal license type) ---
export const VEHICLE_TYPES = [
  { key: "car", label_he: "רכב פרטי" },
  { key: "motorcycle", label_he: "אופנוע / קטנוע" },
  { key: "other", label_he: "אחר" },
] as const;

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
  CHECKIN_WINDOW_BEFORE_MINUTES: 30, // worker CHECK_IN scan opens this many minutes before shift start
  UNCONFIRMED_CUTOFF_HOURS: 2,

  // Late cancellation policy
  LATE_CANCEL_WINDOW_HOURS: 2, // cancelling an approved shift within this many hours of start counts as "late"
  LATE_CANCEL_REVIEW_THRESHOLD: 3, // late cancels before a review incident is opened

  // QR
  QR_TOKEN_TTL_MINUTES: 5,

  // OTP
  OTP_LENGTH: 6,
  OTP_RATE_LIMIT_PER_HOUR: 3,
  OTP_EXPIRY_MINUTES: 10,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Reporting / payments (estimates only — see CLAUDE.md: not the legal employer)
  // Platform fee charged on top of worker pay, used only to compute
  // estimated employer billing / platform margin in reporting screens.
  PLATFORM_FEE_PERCENT: 15,

  // Supplier types for freelancer/vendor payout model
  SUPPLIER_TYPES: [
    { key: "freelancer_exempt", label_he: "עוסק פטור" },
    { key: "freelancer_licensed", label_he: "עוסק מורשה" },
    { key: "company", label_he: "חברה בע\"מ" },
  ] as readonly { key: string; label_he: string }[],
} as const;
