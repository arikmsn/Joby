import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, users, employerProfiles } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminCreateShiftSchema, adminShiftFilterSchema } from "@/lib/validators";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// GET /api/admin/shifts — list/filter shifts across all employers (admin only)
export async function GET(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  const url = new URL(req.url);
  const parsed = adminShiftFilterSchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }
  const { status, employer_id, date, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(shifts.status, status));
  if (employer_id) conditions.push(eq(shifts.employer_id, employer_id));
  if (date) {
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);
    conditions.push(gte(shifts.start_at, dayStart));
    conditions.push(lte(shifts.start_at, dayEnd));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: shifts.id,
        employer_id: shifts.employer_id,
        title: shifts.title,
        role_tag: shifts.role_tag,
        city: shifts.city,
        start_at: shifts.start_at,
        end_at: shifts.end_at,
        pay_rate: shifts.pay_rate,
        pay_type: shifts.pay_type,
        workers_needed: shifts.workers_needed,
        slots_filled: shifts.slots_filled,
        status: shifts.status,
        business_name: employerProfiles.business_name,
        employer_name: users.full_name,
      })
      .from(shifts)
      .leftJoin(users, eq(shifts.employer_id, users.id))
      .leftJoin(employerProfiles, eq(shifts.employer_id, employerProfiles.user_id))
      .where(where)
      .orderBy(desc(shifts.start_at))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(shifts).where(where),
  ]);

  return NextResponse.json({
    data: rows,
    total: countResult[0]?.count || 0,
    page,
    limit,
  });
}

// POST /api/admin/shifts — create a shift on behalf of an employer (admin only)
export async function POST(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminCreateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const employer = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, data.employer_id), eq(users.role, UserRole.EMPLOYER)))
    .limit(1);
  if (!employer[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const status = data.publish ? ShiftStatus.PUBLISHED : ShiftStatus.DRAFT;

  const rows = await db
    .insert(shifts)
    .values({
      employer_id: data.employer_id,
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
      min_trust_score: data.min_trust_score.toString(),
    })
    .returning();

  return NextResponse.json({ shift: rows[0] }, { status: 201 });
}
