import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, employerProfiles, shifts } from "@/lib/schema";
import { ShiftStatus } from "@/lib/constants";

// POST /api/seed — seed demo data (dev only)
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Not in production" }, { status: 403 });
  }

  // Create demo employer
  const [employer] = await db.insert(users).values({
    phone: "+972501111111",
    full_name: "דני כהן",
    role: "employer",
  }).onConflictDoNothing({ target: users.phone }).returning();

  let employerId: string;

  if (employer) {
    employerId = employer.id;
    await db.insert(employerProfiles).values({
      user_id: employerId,
      business_name: "קייטרינג דני",
      business_type: "אירועים",
      address: "רחוב הרצל 10, תל אביב",
    }).onConflictDoNothing();
  } else {
    // Already exists, fetch
    const existing = await db.select().from(users).where(
      (await import("drizzle-orm")).eq(users.phone, "+972501111111")
    ).limit(1);
    employerId = existing[0].id;
  }

  // Create demo worker
  await db.insert(users).values({
    phone: "+972502222222",
    full_name: "שרה לוי",
    role: "worker",
  }).onConflictDoNothing({ target: users.phone });

  // Seed shifts
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 5);

  const demoShifts = [
    {
      employer_id: employerId,
      title: "מלצר לאירוע ערב",
      role_tag: "מלצר",
      description: "אירוע פרטי, 150 מוזמנים. ניסיון בשירות נדרש.",
      location_name: "אולמי הגן",
      city: "תל אביב",
      address: "רחוב אלנבי 50, תל אביב",
      start_at: new Date(tomorrow.setHours(18, 0, 0, 0)),
      end_at: new Date(tomorrow.setHours(23, 30, 0, 0)),
      pay_rate: "55.00",
      pay_type: "hourly",
      workers_needed: 4,
      status: ShiftStatus.PUBLISHED,
      dress_code: "חולצה לבנה, מכנס שחור",
      contact_name: "דני כהן",
      contact_phone: "+972501111111",
    },
    {
      employer_id: employerId,
      title: "ברמן לבר מצווה",
      role_tag: "ברמן",
      description: "בר מצווה, בר פתוח. ניסיון בקוקטיילים יתרון.",
      location_name: "המרכז לאירועים",
      city: "ירושלים",
      address: "רחוב יפו 100, ירושלים",
      start_at: new Date(dayAfter.setHours(19, 0, 0, 0)),
      end_at: new Date(dayAfter.setHours(1, 0, 0, 0)),
      pay_rate: "65.00",
      pay_type: "hourly",
      workers_needed: 2,
      status: ShiftStatus.PUBLISHED,
      dress_code: "חולצה שחורה",
      contact_name: "דני כהן",
      contact_phone: "+972501111111",
    },
    {
      employer_id: employerId,
      title: "טבח עזר לחתונה",
      role_tag: "טבח",
      description: "חתונה גדולה, 300 מוזמנים. עבודה במטבח חם.",
      location_name: "גני התקווה",
      city: "פתח תקווה",
      address: "רחוב ז'בוטינסקי 20, פתח תקווה",
      start_at: new Date(nextWeek.setHours(14, 0, 0, 0)),
      end_at: new Date(nextWeek.setHours(23, 0, 0, 0)),
      pay_rate: "70.00",
      pay_type: "hourly",
      workers_needed: 3,
      status: ShiftStatus.PUBLISHED,
      gear_required: "נעלי עבודה סגורות",
      contact_name: "דני כהן",
      contact_phone: "+972501111111",
    },
    {
      employer_id: employerId,
      title: "סדרן לכנס",
      role_tag: "סדרן",
      location_name: "מרכז הכנסים",
      city: "תל אביב",
      address: "רחוב הירקון 200, תל אביב",
      start_at: new Date(tomorrow.setHours(8, 0, 0, 0)),
      end_at: new Date(tomorrow.setHours(16, 0, 0, 0)),
      pay_rate: "50.00",
      pay_type: "hourly",
      workers_needed: 6,
      status: ShiftStatus.DRAFT,
      contact_name: "דני כהן",
      contact_phone: "+972501111111",
    },
    {
      employer_id: employerId,
      title: "עובד מחסן",
      role_tag: "מחסנאי",
      description: "פריקה וסידור סחורה",
      city: "חיפה",
      address: "אזור התעשייה, חיפה",
      start_at: new Date(dayAfter.setHours(7, 0, 0, 0)),
      end_at: new Date(dayAfter.setHours(15, 0, 0, 0)),
      pay_rate: "350.00",
      pay_type: "fixed",
      workers_needed: 2,
      status: ShiftStatus.PUBLISHED,
      gear_required: "נעלי בטיחות",
      arrival_notes: "להגיע לשער 3",
      contact_name: "דני כהן",
      contact_phone: "+972501111111",
    },
  ];

  for (const s of demoShifts) {
    await db.insert(shifts).values(s);
  }

  return NextResponse.json({ message: "Seed data created", shifts: demoShifts.length });
}
