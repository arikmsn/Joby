// ============================================================
// Joby — Demo shift seeder (showcase data for next 30 days)
//
// Idempotent: identifies demo data by the marker string
// "[DEMO]" in the shift title prefix.  Re-running will skip
// existing demo shifts and skip employers whose phone is
// already in the DB.
//
// Run from app/ directory:
//   node scripts/seed-demo-shifts.mjs
// ============================================================

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(__dirname, "..", ".env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) return trimmed.slice("DATABASE_URL=".length).trim();
  }
  throw new Error("DATABASE_URL not found in .env.local");
}

const sql = neon(loadDatabaseUrl());

// ── Demo employers ───────────────────────────────────────────
const DEMO_EMPLOYERS = [
  {
    phone: "+972501000001",
    full_name: "מנהל אירועי פסגה",
    business_name: "פסגה אירועים בע\"מ",
    business_type: "אירועים",
    city: "תל אביב",
    description: "חברת אירועים מובילה המתמחה בכנסים, חתונות ואירועי חברות.",
  },
  {
    phone: "+972501000002",
    full_name: "מנהל לוגיסטיקה מהיר",
    business_name: "מהיר לוגיסטיקה",
    business_type: "לוגיסטיקה",
    city: "ראשון לציון",
    description: "מרכז הפצה ולוגיסטיקה עם דרישה יומיומית לכוח אדם.",
  },
  {
    phone: "+972501000003",
    full_name: "מנהלת רשת ריסטורנטה",
    business_name: "ריסטורנטה גרופ",
    business_type: "מסעדנות",
    city: "תל אביב",
    description: "רשת מסעדות ופאבים בתל אביב, יפו וגוש דן.",
  },
  {
    phone: "+972501000004",
    full_name: "מנהל קמעונאות שיא",
    business_name: "שיא קמעונאות",
    business_type: "קמעונאות",
    city: "חיפה",
    description: "רשת חנויות אופנה וסלולר בקניונים ברחבי הצפון.",
  },
  {
    phone: "+972501000005",
    full_name: "מנהלת שירותי ניקיון כרמל",
    business_name: "כרמל שירותים",
    business_type: "שירותים",
    city: "ירושלים",
    description: "חברת שירותי ניקיון ותחזוקה לעסקים ומוסדות.",
  },
  {
    phone: "+972501000006",
    full_name: "מנהל מחסני ביג בוקס",
    business_name: "ביג בוקס מחסנים",
    business_type: "לוגיסטיקה",
    city: "פתח תקווה",
    description: "מרכז אחסון ואיקומרס עם פעילות 24/7.",
  },
  {
    phone: "+972501000007",
    full_name: "מנהל שמירה ואבטחה צפון",
    business_name: "שומר הצפון אבטחה",
    business_type: "אבטחה",
    city: "חיפה",
    description: "חברת אבטחה המפעילה צוותים לאירועים ומתקנים.",
  },
  {
    phone: "+972501000008",
    full_name: "מנהלת קייטרינג נגה",
    business_name: "קייטרינג נגה",
    business_type: "קייטרינג",
    city: "נתניה",
    description: "קייטרינג לאירועים פרטיים ועסקיים, 50–500 מנות.",
  },
];

// ── Role catalog (keys must exist in occupation_catalog) ─────
// We also seed any missing keys automatically below.
const EXTRA_OCCUPATIONS = [
  { key: "customer-service-rep", label_he: "נציג שירות לקוחות" },
  { key: "sales-floor", label_he: "איש מכירות פרונטלי" },
  { key: "production-worker", label_he: "עובד ייצור" },
  { key: "maintenance", label_he: "עובד תחזוקה" },
  { key: "event-host", label_he: "דייל אירועים" },
  { key: "admin-assistant", label_he: "עוזר אדמיניסטרציה" },
  { key: "camp-counselor", label_he: "מדריך קייטנה" },
  { key: "telemarketing", label_he: "טלמרקטינג / סוקר" },
  { key: "agriculture", label_he: "עובד חקלאות" },
  { key: "qa-tester", label_he: "בודק QA זמני" },
  { key: "donation-caller", label_he: "טלפן גיוס תרומות" },
  { key: "packing", label_he: "עובד אריזה" },
  { key: "research-assistant", label_he: "עוזר מחקר" },
];

// ── Shift templates ──────────────────────────────────────────
// employerIdx: 0-based index into DEMO_EMPLOYERS
// Each template will be instantiated multiple times across the 30-day window.
const SHIFT_TEMPLATES = [
  // --- Catering / Events (employer 0 — פסגה אירועים) ---
  {
    employerIdx: 0,
    role: "waiter",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] מלצר/ית לאירוע ערב — ${d}`,
    desc: "משמרת ערב באולם אירועים בצפון תל אביב. נדרש/ת ייצוגיות, חיוך ועמידה בלחץ. מדים מסופקים.",
    address: "רחוב דיזנגוף 58, תל אביב",
    startHour: 18, durationHours: 6,
    payMin: 35, payMax: 40, workers: 4,
    dresscode: "חולצה לבנה, מכנסיים שחורים",
  },
  {
    employerIdx: 0,
    role: "events-general",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] צוות הקמה לכנס — ${d}`,
    desc: "הכנת אולם לכנס עסקי: סידור כיסאות, שולחנות, ציוד. עבודה פיזית קלה.",
    address: "מתחם שרונה, תל אביב",
    startHour: 8, durationHours: 5,
    payMin: 37, payMax: 42, workers: 6,
    dresscode: "ביגוד נוח, נעלי בטיחות מועדפות",
  },
  {
    employerIdx: 0,
    role: "steward",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] סדרן/ית לאירוע — ${d}`,
    desc: "כוונון קהל, בקרת כניסה ועזרה כללית באירוע. נדרש/ת נוכחות ומקצועיות.",
    address: "היכל מנורה מבטחים, תל אביב",
    startHour: 19, durationHours: 5,
    payMin: 39, payMax: 45, workers: 3,
    dresscode: "ביגוד אפור כהה, נעלי עור",
  },
  // --- Logistics (employer 1 — מהיר לוגיסטיקה) ---
  {
    employerIdx: 1,
    role: "warehouse",
    city: "ראשון לציון",
    titleFn: (d) => `[DEMO] מחסנאי/ת — ${d}`,
    desc: "ליקוט והכנת הזמנות במחסן פעיל. נדרש/ת כושר גופני וסדר.",
    address: "אזור תעשייה דרומי, ראשון לציון",
    startHour: 6, durationHours: 8,
    payMin: 38, payMax: 45, workers: 5,
  },
  {
    employerIdx: 1,
    role: "picker-packer",
    city: "ראשון לציון",
    titleFn: (d) => `[DEMO] מלקט/ת אי-קומרס — ${d}`,
    desc: "ליקוט הזמנות ממדפים לפי רשימה, אריזה ותיוג. תנאים טובים, צוות צעיר.",
    address: "רחוב העמל 12, ראשון לציון",
    startHour: 14, durationHours: 6,
    payMin: 36, payMax: 42, workers: 8,
  },
  {
    employerIdx: 1,
    role: "courier",
    city: "ראשון לציון",
    titleFn: (d) => `[DEMO] שליח/ה עם רכב — ${d}`,
    desc: "חלוקת חבילות באזור גוש דן. נדרש/ת רישיון ב' ורכב פרטי. תגמול לפי מסלול.",
    address: "מרכז הפצה ראשון לציון",
    startHour: 9, durationHours: 7,
    payMin: 45, payMax: 65, workers: 3,
  },
  // --- Restaurants (employer 2 — ריסטורנטה גרופ) ---
  {
    employerIdx: 2,
    role: "bartender",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] ברמן/ית לפאב — ${d}`,
    desc: "משמרת לילה בפאב פופולרי. קוקטיילים, שירות מהיר, אווירה. טיפים גבוהים.",
    address: "רחוב אלנבי 72, תל אביב",
    startHour: 20, durationHours: 6,
    payMin: 33, payMax: 38, workers: 2,
    dresscode: "ביגוד שחור",
  },
  {
    employerIdx: 2,
    role: "kitchen",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] עובד/ת מטבח — ${d}`,
    desc: "עזרה בהכנת מנות, שמירת סדר ועבודה בצוות במסעדה פעילה. קצב מהיר.",
    address: "שוק הכרמל, תל אביב",
    startHour: 11, durationHours: 7,
    payMin: 37, payMax: 48, workers: 3,
  },
  {
    employerIdx: 2,
    role: "waiter",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] מלצר/ית צהריים — ${d}`,
    desc: "משמרת צהריים במסעדת בשרים עמוסה. שירות שולחן, גבייה, ייצוגיות. טיפים!",
    address: "נמל תל אביב",
    startHour: 12, durationHours: 5,
    payMin: 35, payMax: 40, workers: 4,
  },
  // --- Retail (employer 3 — שיא קמעונאות) ---
  {
    employerIdx: 3,
    role: "sales-floor",
    city: "חיפה",
    titleFn: (d) => `[DEMO] מוכר/ת בחנות אופנה — ${d}`,
    desc: "קבלת לקוחות, הצגת מוצרים, עזרה בבחירה. יעדי מכירה יומיים עם בונוס.",
    address: "קניון לב המפרץ, חיפה",
    startHour: 10, durationHours: 7,
    payMin: 33, payMax: 38, workers: 2,
    dresscode: "ייצוגי/ת, נקי/ה",
  },
  {
    employerIdx: 3,
    role: "customer-service-rep",
    city: "חיפה",
    titleFn: (d) => `[DEMO] נציג/ה שירות לקוחות סלולר — ${d}`,
    desc: "מתן שירות פרונטלי בחנות סלולר, פתרון תקלות וחוזים. הכשרה קצרה תינתן.",
    address: "קניון גרנד קניון, חיפה",
    startHour: 9, durationHours: 8,
    payMin: 36, payMax: 42, workers: 2,
  },
  // --- Cleaning (employer 4 — כרמל שירותים) ---
  {
    employerIdx: 4,
    role: "cleaning",
    city: "ירושלים",
    titleFn: (d) => `[DEMO] עובד/ת ניקיון — ${d}`,
    desc: "ניקיון משרדים בבניין עסקי בירושלים. בוקר מוקדם, כלי ניקיון מסופקים.",
    address: "רחוב יפו 100, ירושלים",
    startHour: 6, durationHours: 4,
    payMin: 36, payMax: 44, workers: 3,
  },
  {
    employerIdx: 4,
    role: "cleaning",
    city: "ירושלים",
    titleFn: (d) => `[DEMO] ניקיון לאחר אירוע — ${d}`,
    desc: "פינוי ושטיפת האולם לאחר אירוע ערב. עבודה מהירה ויסודית. תשלום מיידי.",
    address: "היכל הספורט, ירושלים",
    startHour: 23, durationHours: 3,
    payMin: 42, payMax: 50, workers: 4,
  },
  // --- Warehouse (employer 5 — ביג בוקס) ---
  {
    employerIdx: 5,
    role: "warehouse",
    city: "פתח תקווה",
    titleFn: (d) => `[DEMO] עובד/ת מחסן לילה — ${d}`,
    desc: "עבודה במחסן לילה: קליטת סחורה, מיון, סידור מדפים. תוספת לילה.",
    address: "אזור תעשייה קריית אריה, פתח תקווה",
    startHour: 22, durationHours: 8,
    payMin: 40, payMax: 48, workers: 6,
  },
  {
    employerIdx: 5,
    role: "packing",
    city: "פתח תקווה",
    titleFn: (d) => `[DEMO] עובד/ת אריזה — ${d}`,
    desc: "אריזת מוצרים לפני משלוח. עמדה ישיבה נוחה, סביבה מוזגת. לא נדרשת ניסיון.",
    address: "רחוב המלאכה 3, פתח תקווה",
    startHour: 7, durationHours: 7,
    payMin: 33, payMax: 36, workers: 10,
  },
  // --- Security (employer 6 — שומר הצפון) ---
  {
    employerIdx: 6,
    role: "security",
    city: "חיפה",
    titleFn: (d) => `[DEMO] מאבטח/ת לאירוע — ${d}`,
    desc: "אבטחת כניסה לאירוע מוזיקה. נדרש/ת עבר ביטחוני, כושר גופני. מדים מסופקים.",
    address: "זיקים, חיפה",
    startHour: 18, durationHours: 6,
    payMin: 40, payMax: 48, workers: 5,
  },
  {
    employerIdx: 6,
    role: "security",
    city: "חיפה",
    titleFn: (d) => `[DEMO] שוטר/ת שוק — ${d}`,
    desc: "נוכחות ושמירה בשוק עירוני. 8 שעות, סיורים, תגמול שעתי גבוה.",
    address: "שוק תלפיות, חיפה",
    startHour: 8, durationHours: 8,
    payMin: 42, payMax: 48, workers: 2,
  },
  // --- Catering / Kitchen (employer 7 — קייטרינג נגה) ---
  {
    employerIdx: 7,
    role: "kitchen",
    city: "נתניה",
    titleFn: (d) => `[DEMO] טבח/ית קייטרינג — ${d}`,
    desc: "הכנת מנות לאירוע עסקי. נסיון בסיסי במטבח — חובה. תשלום יומי.",
    address: "אזור תעשייה נתניה",
    startHour: 7, durationHours: 8,
    payMin: 40, payMax: 50, workers: 3,
  },
  {
    employerIdx: 7,
    role: "event-host",
    city: "נתניה",
    titleFn: (d) => `[DEMO] דייל/ת כנס — ${d}`,
    desc: "קבלת אורחים, רישום וניהול שולחן הכניסה בכנס עסקי בנתניה. אנגלית — יתרון.",
    address: "מלון לאונרדו נתניה",
    startHour: 8, durationHours: 8,
    payMin: 38, payMax: 45, workers: 3,
  },
  // --- Additional variety across more cities / roles ---
  {
    employerIdx: 1,
    role: "driver",
    city: "באר שבע",
    titleFn: (d) => `[DEMO] נהג/ת הפצה — ${d}`,
    desc: "נסיעות הפצה באזור הדרום. נדרש/ת רישיון C1. רכב מסופק. ניסיון — יתרון.",
    address: "אזור תעשייה דרום, באר שבע",
    startHour: 7, durationHours: 9,
    payMin: 48, payMax: 60, workers: 2,
  },
  {
    employerIdx: 0,
    role: "production-worker",
    city: "חולון",
    titleFn: (d) => `[DEMO] עובד/ת ייצור — ${d}`,
    desc: "הרכבה ואריזה בקו ייצור. עמידה ממושכת, עבודה חרוצה. הדרכה במקום.",
    address: "אזור תעשייה הדרומי, חולון",
    startHour: 6, durationHours: 8,
    payMin: 34, payMax: 38, workers: 8,
  },
  {
    employerIdx: 3,
    role: "admin-assistant",
    city: "חיפה",
    titleFn: (d) => `[DEMO] עוזר/ת משרד — ${d}`,
    desc: "עזרה אדמיניסטרטיבית: טיפול בדואל, תיוק, תיאום פגישות. היכרות עם אופיס — חובה.",
    address: "רחוב בן גוריון 15, חיפה",
    startHour: 9, durationHours: 6,
    payMin: 38, payMax: 44, workers: 1,
  },
  {
    employerIdx: 7,
    role: "telemarketing",
    city: "נתניה",
    titleFn: (d) => `[DEMO] סוקר/ת טלפוני/ת — ${d}`,
    desc: "ביצוע סקרי שוק טלפוניים. תסריט מובנה, מנחה צוות צמוד. בונוס על יעדים.",
    address: "גבעת שמואל (עבודה מרחוק חלקית)",
    startHour: 10, durationHours: 5,
    payMin: 33, payMax: 38, workers: 5,
  },
  {
    employerIdx: 4,
    role: "maintenance",
    city: "ירושלים",
    titleFn: (d) => `[DEMO] עובד/ת תחזוקה — ${d}`,
    desc: "תיקונים קלים, החלפת נורות, תחזוקה שוטפת במתחם. ידיים טכניות — יתרון.",
    address: "מלון ממילא, ירושלים",
    startHour: 8, durationHours: 7,
    payMin: 38, payMax: 45, workers: 2,
  },
  {
    employerIdx: 2,
    role: "dishwashing",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] שוטף/ת כלים — ${d}`,
    desc: "שטיפת כלים ושמירת ניקיון המטבח. קצב מהיר, צוות תומך.",
    address: "רחוב רוטשילד 50, תל אביב",
    startHour: 17, durationHours: 5,
    payMin: 33, payMax: 37, workers: 2,
  },
  {
    employerIdx: 5,
    role: "agriculture",
    city: "נתניה",
    titleFn: (d) => `[DEMO] עובד/ת קטיף — ${d}`,
    desc: "קטיף ירקות בחממה ליד נתניה. תחנה שעתית, עבודה בחוץ, ביגוד מומלץ.",
    address: "מושב בית יצחק",
    startHour: 6, durationHours: 7,
    payMin: 37, payMax: 44, workers: 10,
  },
  {
    employerIdx: 6,
    role: "setup-teardown",
    city: "באר שבע",
    titleFn: (d) => `[DEMO] הקמה ופירוק — ${d}`,
    desc: "הקמת דוכנים וקישוטים לאירוע. עבודה פיזית, צוות מגובש, תשלום ביום.",
    address: "מרכז הכנסים באר שבע",
    startHour: 7, durationHours: 6,
    payMin: 36, payMax: 42, workers: 5,
  },
  {
    employerIdx: 0,
    role: "brand-promotion",
    city: "תל אביב",
    titleFn: (d) => `[DEMO] פרומוטר/ית — ${d}`,
    desc: "קידום מוצר חדש בנקודות מכירה בתל אביב. נדרש/ת ייצוגיות ואנרגיה. שעות גמישות.",
    address: "מרכז הקניות אוסקר, תל אביב",
    startHour: 12, durationHours: 5,
    payMin: 36, payMax: 42, workers: 3,
  },
];

// ── Day-distribution plan ────────────────────────────────────
// Maps each template index to the days (0=today+1, 29=today+30)
// on which it should appear.  Gives a natural busy/quiet rhythm.

function buildSchedule() {
  // Each template gets 2-3 occurrences spread across 30 days.
  const schedule = []; // { templateIdx, dayOffset }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  SHIFT_TEMPLATES.forEach((t, ti) => {
    // Space 2–3 occurrences per template.
    const count = ti % 3 === 0 ? 3 : 2;
    const step = Math.floor(28 / count);
    for (let i = 0; i < count; i++) {
      // Spread with slight jitter so not all land on the same day.
      const dayOffset = 1 + i * step + (ti % 3);
      if (dayOffset <= 30) schedule.push({ templateIdx: ti, dayOffset });
    }
  });

  return schedule;
}

function randomBetween(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

async function upsertOccupations() {
  for (const occ of EXTRA_OCCUPATIONS) {
    await sql`
      INSERT INTO occupation_catalog (key, label_he, sort_order, is_active)
      VALUES (${occ.key}, ${occ.label_he}, 99, true)
      ON CONFLICT (key) DO NOTHING
    `;
  }
  console.log(`  ✓ Occupation catalog: ${EXTRA_OCCUPATIONS.length} extra entries ensured`);
}

async function upsertEmployers() {
  const ids = [];
  for (const emp of DEMO_EMPLOYERS) {
    // Find or create the user
    const existing = await sql`
      SELECT id FROM users WHERE phone = ${emp.phone} LIMIT 1
    `;
    let userId;
    if (existing.length > 0) {
      userId = existing[0].id;
      console.log(`  → employer exists: ${emp.business_name} (${userId})`);
    } else {
      const [newUser] = await sql`
        INSERT INTO users (phone, full_name, role, is_active)
        VALUES (${emp.phone}, ${emp.full_name}, 'employer', true)
        RETURNING id
      `;
      userId = newUser.id;
      await sql`
        INSERT INTO employer_profiles (user_id, business_name, business_type, city, description)
        VALUES (${userId}, ${emp.business_name}, ${emp.business_type}, ${emp.city}, ${emp.description})
      `;
      console.log(`  + created employer: ${emp.business_name} (${userId})`);
    }
    ids.push(userId);
  }
  return ids;
}

async function seedShifts(employerIds) {
  const schedule = buildSchedule();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;
  let skipped = 0;

  for (const { templateIdx, dayOffset } of schedule) {
    const tmpl = SHIFT_TEMPLATES[templateIdx];
    const employerId = employerIds[tmpl.employerIdx];

    const shiftDate = new Date(today);
    shiftDate.setDate(shiftDate.getDate() + dayOffset);

    const startAt = new Date(shiftDate);
    startAt.setHours(tmpl.startHour, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setHours(startAt.getHours() + tmpl.durationHours);

    const dateLabel = shiftDate.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
    const title = tmpl.titleFn(dateLabel);
    const payRate = randomBetween(tmpl.payMin, tmpl.payMax);
    const workersNeeded = tmpl.workers;

    // Idempotency: skip if a demo shift with this exact title already exists for this employer.
    const dup = await sql`
      SELECT id FROM shifts
      WHERE employer_id = ${employerId}
        AND title = ${title}
      LIMIT 1
    `;
    if (dup.length > 0) {
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO shifts (
        employer_id, title, role_tag, description,
        location_name, city, address,
        start_at, end_at,
        pay_rate, pay_type,
        workers_needed, slots_filled, status,
        dress_code, arrival_notes,
        contact_name, contact_phone,
        min_trust_score
      ) VALUES (
        ${employerId},
        ${title},
        ${tmpl.role},
        ${tmpl.desc},
        ${tmpl.city},
        ${tmpl.city},
        ${tmpl.address},
        ${startAt.toISOString()},
        ${endAt.toISOString()},
        ${payRate},
        'hourly',
        ${workersNeeded},
        0,
        'PUBLISHED',
        ${tmpl.dresscode ?? null},
        ${tmpl.arrivalNotes ?? null},
        ${DEMO_EMPLOYERS[tmpl.employerIdx].full_name},
        ${DEMO_EMPLOYERS[tmpl.employerIdx].phone},
        '0.00'
      )
    `;
    created++;
  }

  return { created, skipped };
}

async function main() {
  console.log("== Joby demo shift seeder ==");

  console.log("\n[1] Ensuring extra occupation catalog entries...");
  await upsertOccupations();

  console.log("\n[2] Upserting demo employers...");
  const employerIds = await upsertEmployers();

  console.log("\n[3] Seeding demo shifts...");
  const { created, skipped } = await seedShifts(employerIds);

  console.log(`\n== Done ==`);
  console.log(`  Employers:  ${DEMO_EMPLOYERS.length} (created or reused)`);
  console.log(`  Shifts created: ${created}`);
  console.log(`  Shifts skipped (already exist): ${skipped}`);
  console.log(`  Total scheduled slots: ${created + skipped}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
