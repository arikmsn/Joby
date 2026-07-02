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

// ============================================================
// Growth Engine (admin-only module) — enums & permission registry
// Server flag: GROWTH_MODULE_ENABLED ("true" to enable APIs)
// Client nav mirror: NEXT_PUBLIC_GROWTH_MODULE_ENABLED
// ============================================================

// --- Growth Sub-Role (users.admin_sub_role; null = no growth access) ---
export const GrowthSubRole = {
  SUPER_ADMIN: "super_admin",
  GROWTH_OPS: "growth_ops",
  GROWTH_ANALYST: "growth_analyst",
  COMPLIANCE_REVIEWER: "compliance_reviewer",
} as const;
export type GrowthSubRole = (typeof GrowthSubRole)[keyof typeof GrowthSubRole];

// --- Growth Permissions (deny-by-default; checked by withGrowthAuth) ---
export const GrowthPermission = {
  SOURCES_READ: "growth:sources.read",
  SOURCES_WRITE: "growth:sources.write",
  SOURCES_APPROVE: "growth:sources.approve",
  OBSERVATIONS_READ: "growth:observations.read",
  OBSERVATIONS_WRITE: "growth:observations.write",
  CLUSTERS_READ: "growth:clusters.read",
  CLUSTERS_ANNOTATE: "growth:clusters.annotate",
  BRIEFS_READ: "growth:briefs.read",
  BRIEFS_APPROVE: "growth:briefs.approve",
  ADS_READ: "growth:ads.read",
  ADS_WRITE: "growth:ads.write",
  ADS_COMPLIANCE: "growth:ads.compliance",
  PUBLICATIONS_READ: "growth:publications.read",
  PUBLICATIONS_WRITE: "growth:publications.write",
  INTAKE_READ: "growth:intake.read",
  INTAKE_REVIEW: "growth:intake.review",
  CANDIDATES_PII: "growth:candidates.pii",
  EMPLOYERS_READ: "growth:employers.read",
  EMPLOYERS_WRITE: "growth:employers.write",
  METRICS_READ: "growth:metrics.read",
  AUDIT_READ: "growth:audit.read",
  ROLES_MANAGE: "growth:roles.manage",
  EXPORT: "growth:export",
} as const;
export type GrowthPermission =
  (typeof GrowthPermission)[keyof typeof GrowthPermission];

// Role → permissions. super_admin implicitly holds everything (see withGrowthAuth).
export const GROWTH_ROLE_PERMISSIONS: Record<
  Exclude<GrowthSubRole, "super_admin">,
  GrowthPermission[]
> = {
  [GrowthSubRole.GROWTH_OPS]: [
    GrowthPermission.SOURCES_READ,
    GrowthPermission.SOURCES_WRITE,
    GrowthPermission.SOURCES_APPROVE,
    GrowthPermission.OBSERVATIONS_READ,
    GrowthPermission.OBSERVATIONS_WRITE,
    GrowthPermission.CLUSTERS_READ,
    GrowthPermission.CLUSTERS_ANNOTATE,
    GrowthPermission.BRIEFS_READ,
    GrowthPermission.BRIEFS_APPROVE,
    GrowthPermission.ADS_READ,
    GrowthPermission.ADS_WRITE,
    GrowthPermission.PUBLICATIONS_READ,
    GrowthPermission.PUBLICATIONS_WRITE,
    GrowthPermission.INTAKE_READ,
    GrowthPermission.INTAKE_REVIEW,
    GrowthPermission.EMPLOYERS_READ,
    GrowthPermission.EMPLOYERS_WRITE,
    GrowthPermission.METRICS_READ,
    GrowthPermission.AUDIT_READ, // own actions only (scoped in handler)
  ],
  [GrowthSubRole.GROWTH_ANALYST]: [
    GrowthPermission.SOURCES_READ,
    GrowthPermission.SOURCES_WRITE, // propose only — approval is a separate permission
    GrowthPermission.OBSERVATIONS_READ,
    GrowthPermission.OBSERVATIONS_WRITE,
    GrowthPermission.CLUSTERS_READ,
    GrowthPermission.BRIEFS_READ,
    GrowthPermission.INTAKE_READ,
    GrowthPermission.INTAKE_REVIEW,
    GrowthPermission.METRICS_READ,
  ],
  [GrowthSubRole.COMPLIANCE_REVIEWER]: [
    GrowthPermission.CLUSTERS_READ,
    GrowthPermission.BRIEFS_READ,
    GrowthPermission.ADS_READ,
    GrowthPermission.ADS_COMPLIANCE,
    GrowthPermission.METRICS_READ,
  ],
};

// --- Source Channel ---
export const SourceChannelType = {
  BOARD: "board",
  FB_GROUP: "fb_group",
  TELEGRAM: "telegram",
  CAREER_PAGE: "career_page",
  AGENCY: "agency",
  GOV: "gov",
  OTHER: "other",
} as const;
export type SourceChannelType =
  (typeof SourceChannelType)[keyof typeof SourceChannelType];

export const CollectionMethod = {
  MANUAL: "manual",
  FETCH: "fetch",
  API: "api",
} as const;
export type CollectionMethod =
  (typeof CollectionMethod)[keyof typeof CollectionMethod];

export const RiskTier = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;
export type RiskTier = (typeof RiskTier)[keyof typeof RiskTier];

export const SourceChannelStatus = {
  PROPOSED: "proposed",
  APPROVED: "approved",
  PAUSED: "paused",
} as const;
export type SourceChannelStatus =
  (typeof SourceChannelStatus)[keyof typeof SourceChannelStatus];

// --- Observations ---
export const SalaryUnit = {
  HOURLY: "hourly",
  MONTHLY: "monthly",
} as const;
export type SalaryUnit = (typeof SalaryUnit)[keyof typeof SalaryUnit];

export const ObservedEmployerType = {
  DIRECT: "direct",
  AGENCY: "agency",
  UNKNOWN: "unknown",
} as const;
export type ObservedEmployerType =
  (typeof ObservedEmployerType)[keyof typeof ObservedEmployerType];

// Raw source text retention (guardrail: facts only, text purged)
export const RAW_TEXT_TTL_DAYS = 30;

// --- Role families (fixed taxonomy for target sectors) ---
export const ROLE_FAMILIES = [
  { key: "warehouse_worker", label_he: "מחסנאי/ת" },
  { key: "order_picker", label_he: "מלקט/ת" },
  { key: "forklift_operator", label_he: "מלגזן/ית" },
  { key: "packer", label_he: "אורז/ת" },
  { key: "logistics_coordinator", label_he: "רכז/ת לוגיסטיקה" },
  { key: "delivery_driver", label_he: "נהג/ת חלוקה" },
  { key: "courier", label_he: "שליח/ה" },
  { key: "production_worker", label_he: "עובד/ת ייצור" },
  { key: "machine_operator", label_he: "מפעיל/ת מכונה" },
  { key: "quality_control", label_he: "בקר/ית איכות" },
  { key: "call_center_rep", label_he: "נציג/ת מוקד" },
  { key: "customer_service", label_he: "נציג/ת שירות לקוחות" },
  { key: "tech_support", label_he: "נציג/ת תמיכה טכנית" },
  { key: "telesales", label_he: "מכירות טלפוניות" },
  { key: "back_office", label_he: "בק אופיס" },
  { key: "receptionist", label_he: "פקיד/ת קבלה" },
  { key: "cleaner", label_he: "עובד/ת ניקיון" },
  { key: "security_guard", label_he: "מאבטח/ת" },
  { key: "general_labor", label_he: "עבודה כללית" },
  { key: "other", label_he: "אחר" },
] as const;
export type RoleFamilyKey = (typeof ROLE_FAMILIES)[number]["key"];

// --- Regions (launch-cell geography) ---
export const GROWTH_REGIONS = [
  { key: "tel_aviv", label_he: "תל אביב והמרכז" },
  { key: "shfela_ashdod", label_he: "אשדוד והשפלה" },
  { key: "sharon", label_he: "השרון" },
  { key: "jerusalem", label_he: "ירושלים והסביבה" },
  { key: "south", label_he: "דרום ובאר שבע" },
  { key: "haifa_krayot", label_he: "חיפה והקריות" },
  { key: "north", label_he: "צפון" },
  { key: "other", label_he: "אחר" },
] as const;
export type GrowthRegionKey = (typeof GROWTH_REGIONS)[number]["key"];

// --- Candidate submission review status ---
export const SubmissionReviewStatus = {
  PENDING: "PENDING",
  REVIEWED: "REVIEWED",
  FLAGGED: "FLAGGED",
} as const;
export type SubmissionReviewStatus =
  (typeof SubmissionReviewStatus)[keyof typeof SubmissionReviewStatus];

// --- Intake experience levels (stored inside availability jsonb) ---
export const INTAKE_EXPERIENCE_LEVELS = [
  { key: "none", label_he: "ללא ניסיון" },
  { key: "lt1", label_he: "עד שנה" },
  { key: "1to3", label_he: "שנה עד 3 שנים" },
  { key: "gt3", label_he: "מעל 3 שנים" },
] as const;
export type IntakeExperienceKey =
  (typeof INTAKE_EXPERIENCE_LEVELS)[number]["key"];

// --- Intake shift-availability options (public form) ---
export const INTAKE_SHIFT_OPTIONS = [
  { key: "morning", label_he: "בוקר" },
  { key: "evening", label_he: "ערב" },
  { key: "night", label_he: "לילה" },
  { key: "weekend", label_he: "סופ״ש" },
] as const;

// Intake rate limits (per hashed key, DB-backed — serverless-safe)
export const INTAKE_RATE_LIMITS = {
  PER_PHONE_PER_HOUR: 3,
  PER_IP_PER_HOUR: 10,
} as const;

// --- Growth audit actions (mandatory-logging list per spec) ---
export const GrowthAuditAction = {
  AUTHZ_DENIED: "AUTHZ_DENIED",
  ROLE_GRANTED: "ROLE_GRANTED",
  ROLE_REVOKED: "ROLE_REVOKED",
  SOURCE_STATUS_CHANGED: "SOURCE_STATUS_CHANGED",
  AD_TRANSITION: "AD_TRANSITION",
  PUBLICATION_RECORDED: "PUBLICATION_RECORDED",
  PII_UNMASKED: "PII_UNMASKED",
  CV_ACCESSED: "CV_ACCESSED",
  EXPORT_REQUESTED: "EXPORT_REQUESTED",
  PURGE_RUN: "PURGE_RUN",
  CONSENT_CHANGED: "CONSENT_CHANGED",
} as const;
export type GrowthAuditAction =
  (typeof GrowthAuditAction)[keyof typeof GrowthAuditAction];

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
