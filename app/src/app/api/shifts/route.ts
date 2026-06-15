import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, users, employerProfiles, sosBroadcasts, applications } from "@/lib/schema";
import { requireRole, requireAuth } from "@/lib/auth";
import { createShiftSchema, shiftFilterSchema } from "@/lib/validators";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { eq, and, gte, lte, ilike, sql, asc, inArray } from "drizzle-orm";

// POST /api/shifts — create a new shift (employer only)
export async function POST(req: NextRequest) {
  const user = await requireRole(req, UserRole.EMPLOYER);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { error: "VALIDATION", message: firstError?.message || "שגיאת אימות", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const status = data.publish ? ShiftStatus.PUBLISHED : ShiftStatus.DRAFT;

  const rows = await db.insert(shifts).values({
    employer_id: user.id,
    title: data.title,
    role_tag: data.role_tag,
    description: data.description || null,
    location_name: data.location_name || null,
    city: data.city || null,
    address: data.address,
    lat: data.lat?.toString() || null,
    lng: data.lng?.toString() || null,
    start_at: new Date(data.start_at),
    end_at: new Date(data.end_at),
    pay_rate: data.pay_rate.toString(),
    pay_type: data.pay_type,
    workers_needed: data.workers_needed,
    status,
    dress_code: data.dress_code || null,
    gear_required: data.gear_required || null,
    arrival_notes: data.arrival_notes || null,
    contact_name: data.contact_name || null,
    contact_phone: data.contact_phone || null,
    requirements_ack: data.requirements_ack || null,
    min_trust_score: data.min_trust_score.toString(),
  }).returning();

  return NextResponse.json({ shift: rows[0] }, { status: 201 });
}

// GET /api/shifts — list shifts (worker feed with filters, or employer list)
export async function GET(req: NextRequest) {
  const authUser = await requireAuth(req);
  if (authUser instanceof NextResponse) return authUser;

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = shiftFilterSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", message: "פרמטרים לא תקינים" }, { status: 400 });
  }

  const { role_tag, role_tags, city, date, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const conditions = [];

  if (authUser.role === UserRole.WORKER) {
    conditions.push(eq(shifts.status, ShiftStatus.PUBLISHED));
    conditions.push(gte(shifts.start_at, new Date()));
  } else if (authUser.role === UserRole.EMPLOYER) {
    conditions.push(eq(shifts.employer_id, authUser.id));
  }

  const roleTagList = role_tags ? role_tags.split(",").map((r) => r.trim()).filter(Boolean) : [];
  if (roleTagList.length > 0) {
    conditions.push(inArray(shifts.role_tag, roleTagList));
  } else if (role_tag) {
    conditions.push(eq(shifts.role_tag, role_tag));
  }
  if (city) conditions.push(ilike(shifts.city, `%${city}%`));
  if (date) {
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);
    conditions.push(gte(shifts.start_at, dayStart));
    conditions.push(lte(shifts.start_at, dayEnd));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db.select({
      id: shifts.id,
      employer_id: shifts.employer_id,
      title: shifts.title,
      role_tag: shifts.role_tag,
      description: shifts.description,
      location_name: shifts.location_name,
      city: shifts.city,
      address: shifts.address,
      start_at: shifts.start_at,
      end_at: shifts.end_at,
      pay_rate: shifts.pay_rate,
      pay_type: shifts.pay_type,
      workers_needed: shifts.workers_needed,
      slots_filled: shifts.slots_filled,
      status: shifts.status,
      dress_code: shifts.dress_code,
      gear_required: shifts.gear_required,
      arrival_notes: shifts.arrival_notes,
      contact_name: shifts.contact_name,
      contact_phone: shifts.contact_phone,
      requirements_ack: shifts.requirements_ack,
      min_trust_score: shifts.min_trust_score,
      created_at: shifts.created_at,
      updated_at: shifts.updated_at,
      employer_name: users.full_name,
      business_name: employerProfiles.business_name,
    })
      .from(shifts)
      .leftJoin(users, eq(shifts.employer_id, users.id))
      .leftJoin(employerProfiles, eq(shifts.employer_id, employerProfiles.user_id))
      .where(where)
      .orderBy(asc(shifts.start_at))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(shifts).where(where),
  ]);

  // For worker feed: check which shifts have active SOS, and which the worker already applied to
  let sosShiftIds: Set<string> = new Set();
  let myApplications: Map<string, { id: string; status: string; is_backup: boolean }> = new Map();
  if (authUser.role === UserRole.WORKER && rows.length > 0) {
    const shiftIds = rows.map((r) => r.id);
    const [sosRows, appRows] = await Promise.all([
      db
        .select({ shift_id: sosBroadcasts.shift_id })
        .from(sosBroadcasts)
        .where(
          and(
            eq(sosBroadcasts.status, "ACTIVE"),
            inArray(sosBroadcasts.shift_id, shiftIds)
          )
        ),
      db
        .select({
          shift_id: applications.shift_id,
          id: applications.id,
          status: applications.status,
          is_backup: applications.is_backup,
        })
        .from(applications)
        .where(
          and(
            eq(applications.worker_id, authUser.id),
            inArray(applications.shift_id, shiftIds)
          )
        ),
    ]);
    sosShiftIds = new Set(sosRows.map((r) => r.shift_id));
    myApplications = new Map(appRows.map((r) => [r.shift_id, { id: r.id, status: r.status, is_backup: r.is_backup }]));
  }

  // For employer list: surface applicant activity (pending / backup) per shift
  const applicantCounts: Map<string, { pending_count: number; backup_count: number }> = new Map();
  if (authUser.role === UserRole.EMPLOYER && rows.length > 0) {
    const shiftIds = rows.map((r) => r.id);
    const countRows = await db
      .select({
        shift_id: applications.shift_id,
        status: applications.status,
        is_backup: applications.is_backup,
        count: sql<number>`count(*)::int`,
      })
      .from(applications)
      .where(inArray(applications.shift_id, shiftIds))
      .groupBy(applications.shift_id, applications.status, applications.is_backup);

    for (const row of countRows) {
      const entry = applicantCounts.get(row.shift_id) || { pending_count: 0, backup_count: 0 };
      if (row.status === "PENDING") entry.pending_count += row.count;
      if (row.is_backup && (row.status === "APPROVED" || row.status === "CONFIRMED")) entry.backup_count += row.count;
      applicantCounts.set(row.shift_id, entry);
    }
  }

  const data = rows.map((r) => ({
    ...r,
    has_sos: sosShiftIds.has(r.id),
    my_application: myApplications.get(r.id) ?? null,
    ...(authUser.role === UserRole.EMPLOYER
      ? { applicants: applicantCounts.get(r.id) || { pending_count: 0, backup_count: 0 } }
      : {}),
  }));

  return NextResponse.json({
    data,
    total: countResult[0]?.count || 0,
    page,
    limit,
  });
}
