// ============================================================
// Joby — Rich demo seed dataset
// Idempotent: all demo accounts use reserved phone prefixes and are
// deleted (cascade) and re-created on every run.
// ============================================================

import { db } from "./db";
import { eq, or, like, inArray } from "drizzle-orm";
import {
  users,
  employerProfiles,
  workerProfiles,
  shifts,
  applications,
  checkinEvents,
  sosBroadcasts,
  ratings,
  incidents,
  notifications,
} from "./schema";
import {
  UserRole,
  ShiftStatus,
  ApplicationStatus,
  SOSStatus,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  CheckMode,
  CheckinSource,
  SLOT_COUNTED_STATUSES,
} from "./constants";
import { recalcTrustScore } from "./trust";

// --- Reserved phone prefixes (idempotency) ---
const ADMIN_PHONE = "+972500999999";
const EMPLOYER_PHONE_PREFIX = "+97250090";
const WORKER_PHONE_PREFIX = "+97250091";

function employerPhone(i: number) {
  return `${EMPLOYER_PHONE_PREFIX}${String(i + 1).padStart(4, "0")}`;
}
function workerPhone(i: number) {
  return `${WORKER_PHONE_PREFIX}${String(i + 1).padStart(4, "0")}`;
}

// --- Static definitions ---

interface EmployerDef {
  full_name: string;
  business_name: string;
  business_type: string;
  city: string;
  address: string;
}

const EMPLOYER_DEFS: EmployerDef[] = [
  { full_name: "דני כהן", business_name: "ביסטרו הכרם", business_type: "מסעדה ובר", city: "תל אביב", address: "רחוב אלנבי 50, תל אביב" },
  { full_name: "מיכל אברהם", business_name: "מופ פרודקשנס", business_type: "הפקת אירועים", city: "ירושלים", address: "רחוב יפו 100, ירושלים" },
  { full_name: "אבי שמעוני", business_name: "קייטרינג השף הלבן", business_type: "קייטרינג", city: "חיפה", address: "שדרות הנשיא 15, חיפה" },
  { full_name: "רונית פרץ", business_name: "לוגיטק שירותי מחסן", business_type: "לוגיסטיקה ומחסנאות", city: "פתח תקווה", address: "אזור התעשייה סגולה, פתח תקווה" },
  { full_name: "יוסי מזרחי", business_name: "פופ-אפ סטור גלריה", business_type: "ריטייל ופעילויות שטח", city: "הרצליה", address: "רחוב סוקולוב 30, הרצליה" },
];

interface WorkerDef {
  full_name: string;
  city: string;
  tags: string[];
  bio?: string;
}

const WORKER_DEFS: WorkerDef[] = [
  { full_name: "נועה כהן", city: "תל אביב", tags: ["waiter", "hostess"] },
  { full_name: "איתי לוי", city: "תל אביב", tags: ["bartender", "events-general"] },
  { full_name: "מיכל ברק", city: "רמת גן", tags: ["hostess", "customer-service"] },
  { full_name: "דניאל אזולאי", city: "תל אביב", tags: ["bartender", "security"] },
  { full_name: "שירה גולן", city: "חולון", tags: ["kitchen", "dishwashing"] },
  { full_name: "עומר פרידמן", city: "ירושלים", tags: ["security", "steward"] },
  { full_name: "טל מורג", city: "ירושלים", tags: ["setup-teardown", "events-general"] },
  { full_name: "יעל שפירא", city: "חיפה", tags: ["warehouse", "picker-packer"] },
  { full_name: "רועי דהן", city: "חיפה", tags: ["driver", "logistics"] },
  { full_name: "אלון נחום", city: "פתח תקווה", tags: ["warehouse", "picker-packer"] },
  { full_name: "ליאור אביטן", city: "פתח תקווה", tags: ["driver", "warehouse"] },
  { full_name: "הדר וקנין", city: "הרצליה", tags: ["sales-promoter", "brand-promotion"] },
  { full_name: "נטע שני", city: "הרצליה", tags: ["hostess", "customer-service"] },
  { full_name: "אסף רובין", city: "תל אביב", tags: ["waiter", "bartender"] },
  { full_name: "גלית מלכה", city: "רמת גן", tags: ["cashier", "sales-promoter"] },
  { full_name: "אור כהן", city: "תל אביב", tags: ["cleaning", "general"] },
  { full_name: "ניר אשכנזי", city: "ירושלים", tags: ["security", "courier"] },
  { full_name: "מאיה פלד", city: "חיפה", tags: ["kitchen", "dishwashing"] },
  { full_name: "בר לוינסון", city: "תל אביב", tags: ["waiter", "hostess"], bio: "עובד חדש" },
  { full_name: "עידן צור", city: "פתח תקווה", tags: ["warehouse", "driver"], bio: "עובד חדש" },
];

// Role -> worker indices with matching experience tags
const WORKERS_BY_ROLE: Record<string, number[]> = {
  waiter: [0, 13, 18],
  bartender: [1, 3, 13],
  kitchen: [4, 17],
  dishwashing: [4, 17],
  hostess: [0, 2, 12, 18],
  "events-general": [1, 6],
  "setup-teardown": [6],
  security: [3, 5, 16],
  steward: [5],
  "picker-packer": [7, 9],
  driver: [8, 10, 19],
  logistics: [8],
  warehouse: [7, 9, 10, 19],
  "sales-promoter": [11, 14],
  "brand-promotion": [11],
  cashier: [14],
  "customer-service": [2, 12],
};

interface RoleInfo {
  title: string;
  description: string;
  dress_code?: string;
  gear_required?: string;
}

const ROLE_INFO: Record<string, RoleInfo> = {
  waiter: { title: "מלצר/ית למשמרת ערב", description: "שירות שולחנות, קבלת הזמנות וליווי האירוח.", dress_code: "חולצה לבנה, מכנס שחור" },
  bartender: { title: "ברמן/ית", description: "הכנת קוקטיילים והגשת משקאות בבר.", dress_code: "חולצה שחורה" },
  kitchen: { title: "עובד/ת מטבח", description: "הכנת מנות ועבודה בקו הבישול.", gear_required: "נעלי עבודה סגורות" },
  dishwashing: { title: "שטיפת כלים", description: "שטיפה וסידור כלי מטבח והגשה." },
  hostess: { title: "קבלת אורחים", description: "קבלת אורחים בכניסה והכוונה לאזורי הישיבה." },
  "events-general": { title: "צוות אירוע כללי", description: "סיוע כללי בהפעלת האירוע לאורך המשמרת." },
  "setup-teardown": { title: "הקמה ופירוק", description: "הקמת ציוד ותפאורה לפני האירוע ופירוק בסיומו.", gear_required: "נעלי עבודה סגורות" },
  security: { title: "אבטחה", description: "אבטחת הכניסות ושמירה על הסדר באירוע." },
  steward: { title: "סדרן/ית", description: "הכוונת אורחים וניהול תורים וזרימת אנשים." },
  "picker-packer": { title: "ליקוט ואריזה", description: "ליקוט הזמנות ואריזתן למשלוח.", gear_required: "נעלי בטיחות" },
  driver: { title: "נהג/ת", description: "חלוקת משלוחים בין סניפים ולקוחות.", gear_required: "רישיון נהיגה בתוקף" },
  logistics: { title: "עובד/ת לוגיסטיקה", description: "תיאום וניהול תנועת סחורה במחסן.", gear_required: "נעלי בטיחות" },
  warehouse: { title: "עובד/ת מחסן", description: "פריקה, סידור ומלאי במחסן.", gear_required: "נעלי בטיחות" },
  "sales-promoter": { title: "נציג/ת מכירות בשטח", description: "קידום מוצרים ומכירה בדוכן." },
  "brand-promotion": { title: "פרומוטר/ית מותג", description: "חלוקת חומרי פרסום וקידום מותג בשטח." },
  cashier: { title: "קופאי/ת", description: "תפעול קופה וטיפול בתשלומים." },
  "customer-service": { title: "שירות לקוחות", description: "מענה לשאלות לקוחות וסיוע בקנייה." },
};

interface ShiftSpec {
  employerIdx: number;
  role: string;
  status: ShiftStatus;
  dayOffset: number; // relative to now, ignored for IN_PROGRESS
  hour: number;
  durationHours: number;
  workersNeeded: number;
  payRate: number;
  payType: "hourly" | "fixed";
  locationName?: string;
  scenario?:
    | "fully_staffed"
    | "extra_backup"
    | "low_spots"
    | "understaffed"
    | "sos"
    | "no_show_case"
    | "recovered_worker"
    | "cancelled_complaint";
}

const SHIFT_SPECS: ShiftSpec[] = [
  // Employer 0 — ביסטרו הכרם (restaurant/bar, Tel Aviv) — fully staffed upcoming shifts
  { employerIdx: 0, role: "waiter", status: ShiftStatus.DRAFT, dayOffset: 3, hour: 18, durationHours: 6, workersNeeded: 3, payRate: 50, payType: "hourly" },
  { employerIdx: 0, role: "bartender", status: ShiftStatus.DRAFT, dayOffset: 5, hour: 19, durationHours: 6, workersNeeded: 2, payRate: 60, payType: "hourly" },
  { employerIdx: 0, role: "waiter", status: ShiftStatus.PUBLISHED, dayOffset: 1, hour: 18, durationHours: 6, workersNeeded: 3, payRate: 52, payType: "hourly", scenario: "fully_staffed" },
  { employerIdx: 0, role: "bartender", status: ShiftStatus.PUBLISHED, dayOffset: 2, hour: 19, durationHours: 7, workersNeeded: 2, payRate: 65, payType: "hourly", scenario: "extra_backup" },
  { employerIdx: 0, role: "hostess", status: ShiftStatus.PUBLISHED, dayOffset: 4, hour: 17, durationHours: 5, workersNeeded: 1, payRate: 48, payType: "hourly", scenario: "fully_staffed" },
  { employerIdx: 0, role: "kitchen", status: ShiftStatus.PUBLISHED, dayOffset: 6, hour: 12, durationHours: 8, workersNeeded: 2, payRate: 55, payType: "hourly", scenario: "fully_staffed" },
  { employerIdx: 0, role: "waiter", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 6, workersNeeded: 3, payRate: 50, payType: "hourly" },
  { employerIdx: 0, role: "dishwashing", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 5, workersNeeded: 1, payRate: 45, payType: "hourly" },
  { employerIdx: 0, role: "waiter", status: ShiftStatus.COMPLETED, dayOffset: -2, hour: 18, durationHours: 6, workersNeeded: 3, payRate: 50, payType: "hourly" },
  { employerIdx: 0, role: "kitchen", status: ShiftStatus.COMPLETED, dayOffset: -7, hour: 12, durationHours: 8, workersNeeded: 2, payRate: 55, payType: "hourly", scenario: "no_show_case" },

  // Employer 1 — מופ פרודקשנס (events, Jerusalem)
  { employerIdx: 1, role: "setup-teardown", status: ShiftStatus.DRAFT, dayOffset: 4, hour: 8, durationHours: 6, workersNeeded: 4, payRate: 50, payType: "hourly" },
  { employerIdx: 1, role: "events-general", status: ShiftStatus.PUBLISHED, dayOffset: 1, hour: 16, durationHours: 8, workersNeeded: 5, payRate: 55, payType: "hourly" },
  { employerIdx: 1, role: "security", status: ShiftStatus.PUBLISHED, dayOffset: 2, hour: 20, durationHours: 8, workersNeeded: 2, payRate: 60, payType: "hourly" },
  { employerIdx: 1, role: "bartender", status: ShiftStatus.PUBLISHED, dayOffset: 3, hour: 18, durationHours: 7, workersNeeded: 2, payRate: 65, payType: "hourly" },
  { employerIdx: 1, role: "steward", status: ShiftStatus.PUBLISHED, dayOffset: 7, hour: 9, durationHours: 9, workersNeeded: 6, payRate: 50, payType: "hourly" },
  { employerIdx: 1, role: "events-general", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 8, workersNeeded: 6, payRate: 55, payType: "hourly", scenario: "sos" },
  { employerIdx: 1, role: "security", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 8, workersNeeded: 2, payRate: 60, payType: "hourly" },
  { employerIdx: 1, role: "events-general", status: ShiftStatus.COMPLETED, dayOffset: -3, hour: 16, durationHours: 8, workersNeeded: 5, payRate: 55, payType: "hourly" },
  { employerIdx: 1, role: "setup-teardown", status: ShiftStatus.COMPLETED, dayOffset: -10, hour: 8, durationHours: 6, workersNeeded: 4, payRate: 50, payType: "hourly" },
  { employerIdx: 1, role: "bartender", status: ShiftStatus.CANCELLED, dayOffset: 2, hour: 18, durationHours: 7, workersNeeded: 2, payRate: 65, payType: "hourly" },

  // Employer 2 — קייטרינג השף הלבן (catering, Haifa)
  { employerIdx: 2, role: "kitchen", status: ShiftStatus.DRAFT, dayOffset: 2, hour: 10, durationHours: 8, workersNeeded: 3, payRate: 58, payType: "hourly" },
  { employerIdx: 2, role: "waiter", status: ShiftStatus.DRAFT, dayOffset: 6, hour: 17, durationHours: 6, workersNeeded: 4, payRate: 52, payType: "hourly" },
  { employerIdx: 2, role: "waiter", status: ShiftStatus.PUBLISHED, dayOffset: 1, hour: 17, durationHours: 6, workersNeeded: 4, payRate: 52, payType: "hourly", scenario: "low_spots" },
  { employerIdx: 2, role: "kitchen", status: ShiftStatus.PUBLISHED, dayOffset: 2, hour: 10, durationHours: 8, workersNeeded: 2, payRate: 58, payType: "hourly" },
  { employerIdx: 2, role: "dishwashing", status: ShiftStatus.PUBLISHED, dayOffset: 3, hour: 17, durationHours: 5, workersNeeded: 2, payRate: 46, payType: "hourly" },
  { employerIdx: 2, role: "events-general", status: ShiftStatus.PUBLISHED, dayOffset: 8, hour: 9, durationHours: 8, workersNeeded: 3, payRate: 54, payType: "hourly" },
  { employerIdx: 2, role: "waiter", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 6, workersNeeded: 4, payRate: 52, payType: "hourly" },
  { employerIdx: 2, role: "kitchen", status: ShiftStatus.COMPLETED, dayOffset: -1, hour: 10, durationHours: 8, workersNeeded: 2, payRate: 58, payType: "hourly" },
  { employerIdx: 2, role: "waiter", status: ShiftStatus.COMPLETED, dayOffset: -4, hour: 17, durationHours: 6, workersNeeded: 4, payRate: 52, payType: "hourly" },
  { employerIdx: 2, role: "dishwashing", status: ShiftStatus.COMPLETED, dayOffset: -8, hour: 17, durationHours: 5, workersNeeded: 2, payRate: 46, payType: "hourly" },

  // Employer 3 — לוגיטק שירותי מחסן (logistics/warehouse, Petah Tikva)
  { employerIdx: 3, role: "warehouse", status: ShiftStatus.DRAFT, dayOffset: 3, hour: 7, durationHours: 8, workersNeeded: 5, payRate: 380, payType: "fixed" },
  { employerIdx: 3, role: "picker-packer", status: ShiftStatus.PUBLISHED, dayOffset: 1, hour: 7, durationHours: 8, workersNeeded: 4, payRate: 55, payType: "hourly", scenario: "understaffed" },
  { employerIdx: 3, role: "driver", status: ShiftStatus.PUBLISHED, dayOffset: 2, hour: 6, durationHours: 9, workersNeeded: 2, payRate: 400, payType: "fixed" },
  { employerIdx: 3, role: "logistics", status: ShiftStatus.PUBLISHED, dayOffset: 5, hour: 7, durationHours: 8, workersNeeded: 3, payRate: 58, payType: "hourly" },
  { employerIdx: 3, role: "warehouse", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 8, workersNeeded: 5, payRate: 380, payType: "fixed" },
  { employerIdx: 3, role: "picker-packer", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 8, workersNeeded: 4, payRate: 55, payType: "hourly" },
  { employerIdx: 3, role: "driver", status: ShiftStatus.COMPLETED, dayOffset: -2, hour: 6, durationHours: 9, workersNeeded: 2, payRate: 400, payType: "fixed" },
  { employerIdx: 3, role: "warehouse", status: ShiftStatus.COMPLETED, dayOffset: -5, hour: 7, durationHours: 8, workersNeeded: 5, payRate: 380, payType: "fixed", scenario: "recovered_worker" },
  { employerIdx: 3, role: "logistics", status: ShiftStatus.COMPLETED, dayOffset: -12, hour: 7, durationHours: 8, workersNeeded: 3, payRate: 58, payType: "hourly" },
  { employerIdx: 3, role: "picker-packer", status: ShiftStatus.CANCELLED, dayOffset: 3, hour: 7, durationHours: 8, workersNeeded: 4, payRate: 55, payType: "hourly" },

  // Employer 4 — פופ-אפ סטור גלריה (retail/pop-up, Herzliya)
  { employerIdx: 4, role: "sales-promoter", status: ShiftStatus.DRAFT, dayOffset: 4, hour: 10, durationHours: 7, workersNeeded: 3, payRate: 50, payType: "hourly" },
  { employerIdx: 4, role: "cashier", status: ShiftStatus.DRAFT, dayOffset: 9, hour: 10, durationHours: 8, workersNeeded: 2, payRate: 48, payType: "hourly" },
  { employerIdx: 4, role: "brand-promotion", status: ShiftStatus.PUBLISHED, dayOffset: 1, hour: 11, durationHours: 6, workersNeeded: 4, payRate: 55, payType: "hourly" },
  { employerIdx: 4, role: "customer-service", status: ShiftStatus.PUBLISHED, dayOffset: 3, hour: 10, durationHours: 8, workersNeeded: 2, payRate: 50, payType: "hourly" },
  { employerIdx: 4, role: "hostess", status: ShiftStatus.PUBLISHED, dayOffset: 6, hour: 16, durationHours: 5, workersNeeded: 1, payRate: 48, payType: "hourly" },
  { employerIdx: 4, role: "sales-promoter", status: ShiftStatus.IN_PROGRESS, dayOffset: 0, hour: 0, durationHours: 7, workersNeeded: 3, payRate: 50, payType: "hourly" },
  { employerIdx: 4, role: "cashier", status: ShiftStatus.COMPLETED, dayOffset: -1, hour: 10, durationHours: 8, workersNeeded: 2, payRate: 48, payType: "hourly" },
  { employerIdx: 4, role: "brand-promotion", status: ShiftStatus.COMPLETED, dayOffset: -6, hour: 11, durationHours: 6, workersNeeded: 4, payRate: 55, payType: "hourly" },
  { employerIdx: 4, role: "customer-service", status: ShiftStatus.CANCELLED, dayOffset: -2, hour: 10, durationHours: 8, workersNeeded: 2, payRate: 50, payType: "hourly", scenario: "cancelled_complaint" },
  { employerIdx: 4, role: "hostess", status: ShiftStatus.CANCELLED, dayOffset: 5, hour: 16, durationHours: 5, workersNeeded: 1, payRate: 48, payType: "hourly" },
];

// --- Date helpers ---
function dayAt(dayOffset: number, hour: number, durationHours: number): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + durationHours);
  return { start, end };
}

function inProgressWindow(durationHours: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(start.getHours() - 2);
  const end = new Date(start);
  end.setHours(end.getHours() + Math.max(durationHours, 3));
  return { start, end };
}

// --- Cleanup ---
// Deletes everything created by a prior run of this seed, identified via the
// reserved phone prefixes. Deletes in dependency order because not all FKs in
// the live DB cascade (checkin_events/ratings -> applications in particular).
async function cleanup() {
  const demoUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.phone, ADMIN_PHONE), like(users.phone, EMPLOYER_PHONE_PREFIX + "%"), like(users.phone, WORKER_PHONE_PREFIX + "%")));
  const userIds = demoUsers.map((u) => u.id);
  if (userIds.length === 0) return;

  const demoShifts = await db.select({ id: shifts.id }).from(shifts).where(inArray(shifts.employer_id, userIds));
  const shiftIds = demoShifts.map((s) => s.id);

  const demoApps = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      shiftIds.length
        ? or(inArray(applications.shift_id, shiftIds), inArray(applications.worker_id, userIds))
        : inArray(applications.worker_id, userIds)
    );
  const appIds = demoApps.map((a) => a.id);

  if (appIds.length) {
    await db.delete(checkinEvents).where(inArray(checkinEvents.application_id, appIds));
    await db.delete(ratings).where(inArray(ratings.application_id, appIds));
    await db.delete(applications).where(inArray(applications.id, appIds));
  }
  if (shiftIds.length) {
    await db.delete(sosBroadcasts).where(inArray(sosBroadcasts.shift_id, shiftIds));
    await db.delete(incidents).where(inArray(incidents.related_shift_id, shiftIds));
  }
  await db.delete(incidents).where(inArray(incidents.related_user_id, userIds));
  await db.delete(notifications).where(inArray(notifications.user_id, userIds));
  if (shiftIds.length) await db.delete(shifts).where(inArray(shifts.id, shiftIds));
  await db.delete(employerProfiles).where(inArray(employerProfiles.user_id, userIds));
  await db.delete(workerProfiles).where(inArray(workerProfiles.user_id, userIds));
  await db.delete(users).where(inArray(users.id, userIds));
}

// --- Seed employers ---
async function seedEmployers() {
  const rows: { id: string; def: EmployerDef }[] = [];
  for (let i = 0; i < EMPLOYER_DEFS.length; i++) {
    const def = EMPLOYER_DEFS[i];
    const [user] = await db
      .insert(users)
      .values({
        phone: employerPhone(i),
        full_name: def.full_name,
        role: UserRole.EMPLOYER,
        created_by_admin: true,
      })
      .returning();
    await db.insert(employerProfiles).values({
      user_id: user.id,
      business_name: def.business_name,
      business_type: def.business_type,
      city: def.city,
      address: def.address,
    });
    rows.push({ id: user.id, def });
  }
  return rows;
}

// --- Seed workers ---
async function seedWorkers() {
  const rows: { id: string; def: WorkerDef }[] = [];
  for (let i = 0; i < WORKER_DEFS.length; i++) {
    const def = WORKER_DEFS[i];
    const [user] = await db
      .insert(users)
      .values({
        phone: workerPhone(i),
        full_name: def.full_name,
        role: UserRole.WORKER,
        created_by_admin: true,
      })
      .returning();
    await db.insert(workerProfiles).values({
      user_id: user.id,
      city: def.city,
      experience_tags: def.tags,
      bio: def.bio || null,
      trust_score: "5.00",
    });
    rows.push({ id: user.id, def });
  }
  return rows;
}

// --- Seed admin ---
async function seedAdmin() {
  const [admin] = await db
    .insert(users)
    .values({
      phone: ADMIN_PHONE,
      full_name: "מנהל מערכת",
      role: UserRole.ADMIN,
      created_by_admin: true,
    })
    .returning();
  return admin.id;
}

// --- Application plan for a shift ---
interface AppPlan {
  workerIdx: number;
  status: ApplicationStatus;
  is_backup: boolean;
}

function rolePool(role: string): number[] {
  return WORKERS_BY_ROLE[role] || [0, 1, 2];
}

const ALL_WORKER_INDICES = Array.from({ length: WORKER_DEFS.length }, (_, i) => i);

// Returns a generator that yields distinct worker indices for a single shift,
// preferring the role-appropriate pool but falling back to any worker.
function makeAllocator(spec: ShiftSpec): { next: () => number; pick: (n: number) => number[] } {
  const pool = rolePool(spec.role);
  const reserved: number[] = [];
  if (spec.scenario === "no_show_case") reserved.push(18);
  if (spec.scenario === "recovered_worker") reserved.push(19);
  if (spec.employerIdx === 3 && spec.role === "logistics" && spec.status === ShiftStatus.COMPLETED && !spec.scenario) {
    reserved.push(19);
  }

  const candidates = [...pool, ...ALL_WORKER_INDICES.filter((i) => !pool.includes(i))];
  const used = new Set<number>(reserved);
  let ptr = 0;
  const next = (): number => {
    while (used.has(candidates[ptr % candidates.length])) ptr++;
    const v = candidates[ptr % candidates.length];
    used.add(v);
    ptr++;
    return v;
  };
  const pick = (n: number) => Array.from({ length: n }, () => next());
  return { next, pick };
}

function buildAppPlan(spec: ShiftSpec): AppPlan[] {
  const { next, pick } = makeAllocator(spec);

  switch (spec.status) {
    case ShiftStatus.DRAFT:
      return [];

    case ShiftStatus.PUBLISHED: {
      if (spec.scenario === "fully_staffed") {
        const approved = pick(spec.workersNeeded).map((w) => ({ workerIdx: w, status: ApplicationStatus.APPROVED, is_backup: false }));
        const pending = { workerIdx: next(), status: ApplicationStatus.PENDING, is_backup: false };
        return [...approved, pending];
      }
      if (spec.scenario === "extra_backup") {
        const approved = pick(spec.workersNeeded).map((w) => ({ workerIdx: w, status: ApplicationStatus.APPROVED, is_backup: false }));
        const backup = { workerIdx: next(), status: ApplicationStatus.APPROVED, is_backup: true };
        const cancelled = { workerIdx: next(), status: ApplicationStatus.CANCELLED_BY_WORKER, is_backup: false };
        return [...approved, backup, cancelled];
      }
      if (spec.scenario === "low_spots") {
        const approved = pick(spec.workersNeeded - 1).map((w) => ({ workerIdx: w, status: ApplicationStatus.APPROVED, is_backup: false }));
        const pending = { workerIdx: next(), status: ApplicationStatus.PENDING, is_backup: false };
        return [...approved, pending];
      }
      if (spec.scenario === "understaffed") {
        const approved = pick(1).map((w) => ({ workerIdx: w, status: ApplicationStatus.APPROVED, is_backup: false }));
        const pending = { workerIdx: next(), status: ApplicationStatus.PENDING, is_backup: false };
        const rejected = { workerIdx: next(), status: ApplicationStatus.REJECTED, is_backup: false };
        return [...approved, pending, rejected];
      }
      // generic
      const fill = Math.max(spec.workersNeeded - 1, 1);
      const approved = pick(fill).map((w) => ({ workerIdx: w, status: ApplicationStatus.APPROVED, is_backup: false }));
      const pending = { workerIdx: next(), status: ApplicationStatus.PENDING, is_backup: false };
      const rejected = { workerIdx: next(), status: ApplicationStatus.REJECTED, is_backup: false };
      return [...approved, pending, rejected];
    }

    case ShiftStatus.IN_PROGRESS: {
      if (spec.scenario === "sos") {
        const filled = Math.max(spec.workersNeeded - 2, 1);
        const checkedIn = pick(filled - 1).map((w) => ({ workerIdx: w, status: ApplicationStatus.CHECKED_IN, is_backup: false }));
        const confirmed = { workerIdx: next(), status: ApplicationStatus.CONFIRMED, is_backup: false };
        return [...checkedIn, confirmed];
      }
      const checkedIn = pick(spec.workersNeeded - 1).map((w) => ({ workerIdx: w, status: ApplicationStatus.CHECKED_IN, is_backup: false }));
      const confirmed = { workerIdx: next(), status: ApplicationStatus.CONFIRMED, is_backup: false };
      const unconfirmed = { workerIdx: next(), status: ApplicationStatus.UNCONFIRMED, is_backup: false };
      return [...checkedIn, confirmed, unconfirmed];
    }

    case ShiftStatus.COMPLETED: {
      if (spec.scenario === "no_show_case") {
        const rated = pick(spec.workersNeeded - 1).map((w) => ({ workerIdx: w, status: ApplicationStatus.RATED, is_backup: false }));
        const noShow = { workerIdx: 18, status: ApplicationStatus.NO_SHOW, is_backup: false };
        return [...rated, noShow];
      }
      if (spec.scenario === "recovered_worker") {
        const rated = pick(spec.workersNeeded - 1).map((w) => ({ workerIdx: w, status: ApplicationStatus.RATED, is_backup: false }));
        const recovered = { workerIdx: 19, status: ApplicationStatus.RATED, is_backup: false };
        return [...rated, recovered];
      }
      const ratedCount = Math.max(spec.workersNeeded - 1, 1);
      const rated = pick(ratedCount).map((w) => ({ workerIdx: w, status: ApplicationStatus.RATED, is_backup: false }));
      const checkedOut = { workerIdx: next(), status: ApplicationStatus.CHECKED_OUT, is_backup: false };
      // employer3's earlier logistics shift carries worker 19's pre-recovery no-show
      if (spec.employerIdx === 3 && spec.role === "logistics") {
        return [...rated.slice(0, -1), { workerIdx: 19, status: ApplicationStatus.NO_SHOW, is_backup: false }, checkedOut];
      }
      return [...rated, checkedOut];
    }

    case ShiftStatus.CANCELLED: {
      if (spec.scenario === "cancelled_complaint") {
        return pick(2).map((w) => ({ workerIdx: w, status: ApplicationStatus.CANCELLED_BY_SYSTEM, is_backup: false }));
      }
      return pick(1).map((w) => ({ workerIdx: w, status: ApplicationStatus.CANCELLED_BY_SYSTEM, is_backup: false }));
    }

    default:
      return [];
  }
}

// --- Main seed function ---
export async function seedDemoData() {
  await cleanup();

  const employerRows = await seedEmployers();
  const workerRows = await seedWorkers();
  await seedAdmin();

  const statusCounts: Record<string, number> = {};
  const appStatusCounts: Record<string, number> = {};

  const createdShifts: {
    id: string;
    spec: ShiftSpec;
    plan: AppPlan[];
    createdApps: { id: string; workerIdx: number; status: ApplicationStatus; is_backup: boolean }[];
  }[] = [];

  // Shifts + applications
  for (const spec of SHIFT_SPECS) {
    const employer = employerRows[spec.employerIdx];
    const roleInfo = ROLE_INFO[spec.role];
    const { start, end } =
      spec.status === ShiftStatus.IN_PROGRESS ? inProgressWindow(spec.durationHours) : dayAt(spec.dayOffset, spec.hour, spec.durationHours);

    const plan = buildAppPlan(spec);
    const slotsFilled = plan.filter((p) => !p.is_backup && SLOT_COUNTED_STATUSES.includes(p.status)).length;

    const [shift] = await db
      .insert(shifts)
      .values({
        employer_id: employer.id,
        title: roleInfo.title,
        role_tag: spec.role,
        description: roleInfo.description,
        location_name: spec.locationName || employer.def.business_name,
        city: employer.def.city,
        address: employer.def.address,
        start_at: start,
        end_at: end,
        pay_rate: spec.payRate.toFixed(2),
        pay_type: spec.payType,
        workers_needed: spec.workersNeeded,
        slots_filled: Math.min(slotsFilled, spec.workersNeeded),
        status: spec.status,
        dress_code: roleInfo.dress_code || null,
        gear_required: roleInfo.gear_required || null,
        contact_name: employer.def.full_name,
        contact_phone: employerPhone(spec.employerIdx),
      })
      .returning();

    statusCounts[spec.status] = (statusCounts[spec.status] || 0) + 1;

    const createdApps: { id: string; workerIdx: number; status: ApplicationStatus; is_backup: boolean }[] = [];
    for (const p of plan) {
      const worker = workerRows[p.workerIdx];
      const now = new Date();
      const [app] = await db
        .insert(applications)
        .values({
          shift_id: shift.id,
          worker_id: worker.id,
          status: p.status,
          is_backup: p.is_backup,
          applied_at: now,
          approved_at: p.status === ApplicationStatus.PENDING ? null : now,
        })
        .returning();
      createdApps.push({ id: app.id, workerIdx: p.workerIdx, status: p.status, is_backup: p.is_backup });
      appStatusCounts[p.status] = (appStatusCounts[p.status] || 0) + 1;
    }

    createdShifts.push({ id: shift.id, spec, plan, createdApps });
  }

  // Checkin events + SOS
  let sosCount = 0;
  for (const cs of createdShifts) {
    if (cs.spec.status === ShiftStatus.IN_PROGRESS) {
      for (const app of cs.createdApps) {
        if (app.status === ApplicationStatus.CHECKED_IN) {
          await db.insert(checkinEvents).values({
            application_id: app.id,
            event_type: CheckMode.CHECK_IN,
            source: CheckinSource.QR,
          });
        }
      }
      if (cs.spec.scenario === "sos") {
        const filled = cs.createdApps.filter((a) => SLOT_COUNTED_STATUSES.includes(a.status)).length;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 3);
        await db.insert(sosBroadcasts).values({
          shift_id: cs.id,
          employer_id: employerRows[cs.spec.employerIdx].id,
          slots_needed: Math.max(cs.spec.workersNeeded - filled, 1),
          sent_to_count: 12,
          filled_count: 0,
          status: SOSStatus.ACTIVE,
          expires_at: expiresAt,
        });
        sosCount++;
      }
    }
    if (cs.spec.status === ShiftStatus.COMPLETED) {
      for (const app of cs.createdApps) {
        if (app.status === ApplicationStatus.CHECKED_OUT || app.status === ApplicationStatus.RATED) {
          await db.insert(checkinEvents).values({
            application_id: app.id,
            event_type: CheckMode.CHECK_IN,
            source: CheckinSource.QR,
          });
          await db.insert(checkinEvents).values({
            application_id: app.id,
            event_type: CheckMode.CHECK_OUT,
            source: app.workerIdx % 2 === 0 ? CheckinSource.QR : CheckinSource.MANUAL,
            scanned_by_user_id: app.workerIdx % 2 === 0 ? null : employerRows[cs.spec.employerIdx].id,
          });
        }
      }
    }
  }

  // Ratings for RATED applications
  let ratingCount = 0;
  const ratingComments = ["עבד/ה מצוין/ת, מומלץ/ת!", "הגיע/ה בזמן ועבד/ה ביעילות", "ביצוע טוב, ישמח/תשמח לעבוד עם/ה שוב", "תקשורת טובה וגישה חיובית"];
  for (const cs of createdShifts) {
    if (cs.spec.status !== ShiftStatus.COMPLETED) continue;
    for (const app of cs.createdApps) {
      if (app.status !== ApplicationStatus.RATED) continue;
      const score = app.workerIdx === 19 ? 5 : 4 + (app.workerIdx % 2);
      await db.insert(ratings).values({
        application_id: app.id,
        shift_id: cs.id,
        worker_id: workerRows[app.workerIdx].id,
        employer_id: employerRows[cs.spec.employerIdx].id,
        score,
        comment: ratingComments[app.workerIdx % ratingComments.length],
      });
      ratingCount++;
    }
  }

  // Recalculate trust scores deterministically from application history
  const trustResults: { full_name: string; trust_score: number }[] = [];
  for (const w of workerRows) {
    const score = await recalcTrustScore(w.id);
    trustResults.push({ full_name: w.def.full_name, trust_score: score });
  }

  // Incidents
  const noShowShift = createdShifts.find((cs) => cs.spec.scenario === "no_show_case")!;
  const noShowApp = noShowShift.createdApps.find((a) => a.status === ApplicationStatus.NO_SHOW)!;
  const understaffedShift = createdShifts.find((cs) => cs.spec.scenario === "understaffed")!;
  const cancelledComplaintShift = createdShifts.find((cs) => cs.spec.scenario === "cancelled_complaint")!;

  const incidentRows = await db
    .insert(incidents)
    .values([
      {
        incident_type: IncidentType.NO_SHOW,
        severity: IncidentSeverity.MEDIUM,
        status: IncidentStatus.OPEN,
        title: "אי-הגעת עובד למשמרת",
        description: "עובד לא הגיע למשמרת ולא עדכן את המעסיק.",
        related_user_id: workerRows[18].id,
        related_shift_id: noShowShift.id,
        related_application_id: noShowApp.id,
      },
      {
        incident_type: IncidentType.LOW_TRUST,
        severity: IncidentSeverity.HIGH,
        status: IncidentStatus.OPEN,
        title: "ציון אמינות נמוך מהממוצע",
        description: "ציון האמינות של העובד ירד עקב אי-הגעות חוזרות. מומלץ לבדוק לפני שיבוץ נוסף.",
        related_user_id: workerRows[18].id,
      },
      {
        incident_type: IncidentType.SHIFT_UNFILLED,
        severity: IncidentSeverity.HIGH,
        status: IncidentStatus.IN_REVIEW,
        title: "משמרת לא מאוישת במלואה",
        description: "המשמרת מתקרבת והאיוש נמוך משמעותית מהדרישה.",
        related_shift_id: understaffedShift.id,
      },
      {
        incident_type: IncidentType.EMPLOYER_COMPLAINT,
        severity: IncidentSeverity.MEDIUM,
        status: IncidentStatus.OPEN,
        title: "ביטול משמרת על ידי המעסיק",
        description: "המעסיק ביטל את המשמרת לאחר שעובדים אושרו, ופנה לבדיקת מדיניות הביטולים.",
        related_shift_id: cancelledComplaintShift.id,
      },
    ])
    .returning();

  // Notifications
  const notifRowsToInsert: (typeof notifications.$inferInsert)[] = [];

  for (const cs of createdShifts) {
    for (const app of cs.createdApps) {
      const workerId = workerRows[app.workerIdx].id;
      const employerId = employerRows[cs.spec.employerIdx].id;
      const roleTitle = ROLE_INFO[cs.spec.role].title;

      switch (app.status) {
        case ApplicationStatus.APPROVED:
          notifRowsToInsert.push({
            user_id: workerId,
            type: "application_approved",
            title: "המועמדות שלך אושרה",
            body: `אושרת למשמרת "${roleTitle}"`,
            is_read: Math.random() > 0.5,
          });
          break;
        case ApplicationStatus.PENDING:
          notifRowsToInsert.push({
            user_id: employerId,
            type: "new_application",
            title: "מועמדות חדשה למשמרת",
            body: `התקבלה מועמדות חדשה למשמרת "${roleTitle}"`,
            is_read: false,
          });
          break;
        case ApplicationStatus.REJECTED:
          notifRowsToInsert.push({
            user_id: workerId,
            type: "application_rejected",
            title: "המועמדות שלך נדחתה",
            body: `המועמדות למשמרת "${roleTitle}" נדחתה`,
            is_read: true,
          });
          break;
        case ApplicationStatus.UNCONFIRMED:
          notifRowsToInsert.push({
            user_id: workerId,
            type: "confirmation_request",
            title: "נדרש אישור הגעה",
            body: `אנא אשר/י הגעה למשמרת "${roleTitle}"`,
            is_read: false,
          });
          break;
        case ApplicationStatus.NO_SHOW:
          notifRowsToInsert.push({
            user_id: employerId,
            type: "worker_no_show",
            title: "עובד לא הגיע למשמרת",
            body: `עובד לא הגיע למשמרת "${roleTitle}"`,
            is_read: false,
          });
          break;
        case ApplicationStatus.RATED:
          notifRowsToInsert.push({
            user_id: workerId,
            type: "rating_request",
            title: "המשמרת הושלמה",
            body: `דרג/י את החוויה ממשמרת "${roleTitle}"`,
            is_read: true,
          });
          break;
        case ApplicationStatus.CANCELLED_BY_SYSTEM:
          notifRowsToInsert.push({
            user_id: workerId,
            type: "shift_cancelled",
            title: "המשמרת בוטלה",
            body: `משמרת "${roleTitle}" בוטלה על ידי המעסיק`,
            is_read: false,
          });
          break;
        default:
          break;
      }
    }
    if (cs.spec.scenario === "sos") {
      for (const w of [0, 1, 2]) {
        notifRowsToInsert.push({
          user_id: workerRows[w].id,
          type: "sos_broadcast",
          title: "קריאת SOS - דרושים עובדים בדחיפות",
          body: `נדרשים עובדים נוספים למשמרת "${ROLE_INFO[cs.spec.role].title}"`,
          is_read: false,
        });
      }
    }
    if (cs.spec.scenario === "extra_backup") {
      const backupApp = cs.createdApps.find((a) => a.is_backup);
      if (backupApp) {
        notifRowsToInsert.push({
          user_id: workerRows[backupApp.workerIdx].id,
          type: "backup_confirmed",
          title: "נרשמת כעובד גיבוי",
          body: `נרשמת כעובד גיבוי למשמרת "${ROLE_INFO[cs.spec.role].title}"`,
          is_read: true,
        });
      }
    }
  }

  if (notifRowsToInsert.length > 0) {
    await db.insert(notifications).values(notifRowsToInsert);
  }

  return {
    employers: employerRows.length,
    workers: workerRows.length,
    shifts: createdShifts.length,
    shiftsByStatus: statusCounts,
    applications: Object.values(appStatusCounts).reduce((a, b) => a + b, 0),
    applicationsByStatus: appStatusCounts,
    sosBroadcasts: sosCount,
    ratings: ratingCount,
    incidents: incidentRows.length,
    notifications: notifRowsToInsert.length,
    trustScores: trustResults,
  };
}
