import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, users, employerProfiles } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { updateShiftSchema, shiftStatusSchema } from "@/lib/validators";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { eq } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// Valid status transitions (mirrors /api/shifts/[id]/status)
const VALID_TRANSITIONS: Record<string, string[]> = {
  [ShiftStatus.DRAFT]: [ShiftStatus.PUBLISHED, ShiftStatus.CANCELLED],
  [ShiftStatus.PUBLISHED]: [ShiftStatus.CANCELLED],
};

// GET /api/admin/shifts/:id — shift detail (admin only)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  const rows = await db
    .select({
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
      min_trust_score: shifts.min_trust_score,
      created_at: shifts.created_at,
      updated_at: shifts.updated_at,
      employer_name: users.full_name,
      business_name: employerProfiles.business_name,
    })
    .from(shifts)
    .leftJoin(users, eq(shifts.employer_id, users.id))
    .leftJoin(employerProfiles, eq(shifts.employer_id, employerProfiles.user_id))
    .where(eq(shifts.id, params.id))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.shift_not_found") }, { status: 404 });
  }

  return NextResponse.json({ shift: rows[0] });
}

// PATCH /api/admin/shifts/:id — edit shift fields and/or transition status (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const existing = await db.select().from(shifts).where(eq(shifts.id, params.id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.shift_not_found") }, { status: 404 });
  }
  const shift = existing[0];

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const parsedStatus = shiftStatusSchema.safeParse({ status: body.status });
    if (!parsedStatus.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: parsedStatus.error.issues[0]?.message || t("error.validation") },
        { status: 400 }
      );
    }
    const newStatus = parsedStatus.data.status;
    const allowed = VALID_TRANSITIONS[shift.status] || [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({ error: "INVALID_TRANSITION", message: t("error.invalid_transition") }, { status: 400 });
    }
    updates.status = newStatus;
  }

  const rest = { ...body };
  delete rest.status;
  if (Object.keys(rest).length > 0) {
    const parsed = updateShiftSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
        { status: 400 }
      );
    }
    const data = parsed.data;
    if (data.title !== undefined) updates.title = data.title;
    if (data.role_tag !== undefined) updates.role_tag = data.role_tag;
    if (data.description !== undefined) updates.description = data.description;
    if (data.location_name !== undefined) updates.location_name = data.location_name;
    if (data.city !== undefined) updates.city = data.city;
    if (data.address !== undefined) updates.address = data.address;
    if (data.lat !== undefined) updates.lat = data.lat.toString();
    if (data.lng !== undefined) updates.lng = data.lng.toString();
    if (data.start_at !== undefined) updates.start_at = new Date(data.start_at);
    if (data.end_at !== undefined) updates.end_at = new Date(data.end_at);
    if (data.pay_rate !== undefined) updates.pay_rate = data.pay_rate.toString();
    if (data.pay_type !== undefined) updates.pay_type = data.pay_type;
    if (data.workers_needed !== undefined) updates.workers_needed = data.workers_needed;
    if (data.dress_code !== undefined) updates.dress_code = data.dress_code;
    if (data.gear_required !== undefined) updates.gear_required = data.gear_required;
    if (data.arrival_notes !== undefined) updates.arrival_notes = data.arrival_notes;
    if (data.contact_name !== undefined) updates.contact_name = data.contact_name;
    if (data.contact_phone !== undefined) updates.contact_phone = data.contact_phone;
    if (data.min_trust_score !== undefined) updates.min_trust_score = data.min_trust_score.toString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ shift });
  }

  updates.updated_at = new Date();

  const updated = await db
    .update(shifts)
    .set(updates)
    .where(eq(shifts.id, params.id))
    .returning();

  return NextResponse.json({ shift: updated[0] });
}
