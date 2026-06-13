import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, employerProfiles, shifts } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminUpdateEmployerSchema } from "@/lib/validators";
import { UserRole } from "@/lib/constants";
import { eq, and, sql } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// GET /api/admin/employers/:id — employer detail with shift counts (admin only)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  const rows = await db
    .select({
      id: users.id,
      phone: users.phone,
      full_name: users.full_name,
      is_active: users.is_active,
      created_by_admin: users.created_by_admin,
      created_at: users.created_at,
      business_name: employerProfiles.business_name,
      business_type: employerProfiles.business_type,
      address: employerProfiles.address,
      city: employerProfiles.city,
    })
    .from(users)
    .leftJoin(employerProfiles, eq(users.id, employerProfiles.user_id))
    .where(and(eq(users.id, params.id), eq(users.role, UserRole.EMPLOYER)))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const shiftCounts = await db
    .select({ status: shifts.status, count: sql<number>`count(*)::int` })
    .from(shifts)
    .where(eq(shifts.employer_id, params.id))
    .groupBy(shifts.status);

  return NextResponse.json({ employer: rows[0], shift_counts: shiftCounts });
}

// PATCH /api/admin/employers/:id — edit employer profile / activation (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminUpdateEmployerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, params.id), eq(users.role, UserRole.EMPLOYER)))
    .limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  if (data.full_name !== undefined || data.is_active !== undefined) {
    await db
      .update(users)
      .set({
        ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        updated_at: new Date(),
      })
      .where(eq(users.id, params.id));
  }

  if (
    data.business_name !== undefined ||
    data.business_type !== undefined ||
    data.address !== undefined ||
    data.city !== undefined
  ) {
    await db
      .update(employerProfiles)
      .set({
        ...(data.business_name !== undefined ? { business_name: data.business_name } : {}),
        ...(data.business_type !== undefined ? { business_type: data.business_type } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
      })
      .where(eq(employerProfiles.user_id, params.id));
  }

  const rows = await db
    .select({
      id: users.id,
      phone: users.phone,
      full_name: users.full_name,
      is_active: users.is_active,
      created_by_admin: users.created_by_admin,
      created_at: users.created_at,
      business_name: employerProfiles.business_name,
      business_type: employerProfiles.business_type,
      address: employerProfiles.address,
      city: employerProfiles.city,
    })
    .from(users)
    .leftJoin(employerProfiles, eq(users.id, employerProfiles.user_id))
    .where(eq(users.id, params.id))
    .limit(1);

  return NextResponse.json({ employer: rows[0] });
}
