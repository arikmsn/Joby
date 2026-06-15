import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, users, employerProfiles, applications } from "@/lib/schema";
import { requireAuth, requireRole } from "@/lib/auth";
import { updateShiftSchema } from "@/lib/validators";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { eq, and } from "drizzle-orm";

// GET /api/shifts/:id — get shift details
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await requireAuth(req);
  if (authUser instanceof NextResponse) return authUser;

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
    .where(eq(shifts.id, params.id))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: "משמרת לא נמצאה" }, { status: 404 });
  }

  // Workers can only see published shifts (unless they already applied)
  const shift = rows[0];

  let myApplication: { id: string; status: string; is_backup: boolean } | null = null;
  if (authUser.role === UserRole.WORKER) {
    const appRows = await db
      .select({
        id: applications.id,
        status: applications.status,
        is_backup: applications.is_backup,
      })
      .from(applications)
      .where(and(eq(applications.shift_id, shift.id), eq(applications.worker_id, authUser.id)))
      .limit(1);
    myApplication = appRows[0] ?? null;

    if (shift.status !== ShiftStatus.PUBLISHED && !myApplication) {
      return NextResponse.json({ error: "NOT_FOUND", message: "משמרת לא נמצאה" }, { status: 404 });
    }
  }

  // Employers can only see their own shifts
  if (authUser.role === UserRole.EMPLOYER && shift.employer_id !== authUser.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: "אין הרשאה" }, { status: 403 });
  }

  return NextResponse.json({ shift: { ...shift, my_application: myApplication } });
}

// PATCH /api/shifts/:id — edit shift (employer only, draft only for full edit, limited edit for published)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRole(req, UserRole.EMPLOYER);
  if (user instanceof NextResponse) return user;

  // Fetch existing shift
  const existing = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, params.id), eq(shifts.employer_id, user.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: "משמרת לא נמצאה" }, { status: 404 });
  }

  const shift = existing[0];

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || "שגיאת אימות" },
      { status: 400 }
    );
  }

  // If published, only allow limited fields
  if (shift.status === ShiftStatus.PUBLISHED) {
    const allowedPublished = ["description", "dress_code", "gear_required", "arrival_notes", "contact_name", "contact_phone", "requirements_ack"];
    const keys = Object.keys(parsed.data).filter((k) => (parsed.data as Record<string, unknown>)[k] !== undefined);
    const disallowed = keys.filter((k) => !allowedPublished.includes(k));
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "לא ניתן לשנות שדות אלו במשמרת שפורסמה: " + disallowed.join(", ") },
        { status: 403 }
      );
    }
  } else if (shift.status !== ShiftStatus.DRAFT) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "ניתן לערוך רק משמרות בטיוטה או פורסמו" },
      { status: 403 }
    );
  }

  const updateData: Record<string, unknown> = { updated_at: new Date() };
  const d = parsed.data;
  if (d.title !== undefined) updateData.title = d.title;
  if (d.role_tag !== undefined) updateData.role_tag = d.role_tag;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.location_name !== undefined) updateData.location_name = d.location_name;
  if (d.city !== undefined) updateData.city = d.city;
  if (d.address !== undefined) updateData.address = d.address;
  if (d.lat !== undefined) updateData.lat = d.lat.toString();
  if (d.lng !== undefined) updateData.lng = d.lng.toString();
  if (d.start_at !== undefined) updateData.start_at = new Date(d.start_at);
  if (d.end_at !== undefined) updateData.end_at = new Date(d.end_at);
  if (d.pay_rate !== undefined) updateData.pay_rate = d.pay_rate.toString();
  if (d.pay_type !== undefined) updateData.pay_type = d.pay_type;
  if (d.workers_needed !== undefined) updateData.workers_needed = d.workers_needed;
  if (d.dress_code !== undefined) updateData.dress_code = d.dress_code;
  if (d.gear_required !== undefined) updateData.gear_required = d.gear_required;
  if (d.arrival_notes !== undefined) updateData.arrival_notes = d.arrival_notes;
  if (d.contact_name !== undefined) updateData.contact_name = d.contact_name;
  if (d.contact_phone !== undefined) updateData.contact_phone = d.contact_phone;
  if (d.requirements_ack !== undefined) updateData.requirements_ack = d.requirements_ack;
  if (d.min_trust_score !== undefined) updateData.min_trust_score = d.min_trust_score.toString();

  const updated = await db
    .update(shifts)
    .set(updateData)
    .where(eq(shifts.id, params.id))
    .returning();

  return NextResponse.json({ shift: updated[0] });
}
