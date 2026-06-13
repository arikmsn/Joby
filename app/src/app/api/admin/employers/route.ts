import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, employerProfiles } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminCreateEmployerSchema, adminListQuerySchema } from "@/lib/validators";
import { UserRole } from "@/lib/constants";
import { eq, or, ilike, and, sql, desc } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// GET /api/admin/employers — list/search employers (admin only)
export async function GET(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  const url = new URL(req.url);
  const parsed = adminListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }
  const { q, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(users.role, UserRole.EMPLOYER)];
  if (q) {
    conditions.push(
      or(
        ilike(users.full_name, `%${q}%`),
        ilike(employerProfiles.business_name, `%${q}%`),
        ilike(employerProfiles.city, `%${q}%`)
      )!
    );
  }
  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: users.id,
        phone: users.phone,
        full_name: users.full_name,
        is_active: users.is_active,
        created_by_admin: users.created_by_admin,
        created_at: users.created_at,
        business_name: employerProfiles.business_name,
        business_type: employerProfiles.business_type,
        city: employerProfiles.city,
        address: employerProfiles.address,
      })
      .from(users)
      .leftJoin(employerProfiles, eq(users.id, employerProfiles.user_id))
      .where(where)
      .orderBy(desc(users.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(employerProfiles, eq(users.id, employerProfiles.user_id))
      .where(where),
  ]);

  return NextResponse.json({
    data: rows,
    total: countResult[0]?.count || 0,
    page,
    limit,
  });
}

// POST /api/admin/employers — create a new employer account (admin only)
export async function POST(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminCreateEmployerSchema.safeParse(body);
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
    .where(eq(users.phone, data.phone))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "USER_EXISTS", message: t("error.user_exists") }, { status: 409 });
  }

  const insertedUsers = await db
    .insert(users)
    .values({
      phone: data.phone,
      full_name: data.full_name,
      role: UserRole.EMPLOYER,
      created_by_admin: true,
    })
    .returning();
  const user = insertedUsers[0];

  const insertedProfiles = await db
    .insert(employerProfiles)
    .values({
      user_id: user.id,
      business_name: data.business_name,
      business_type: data.business_type || null,
      address: data.address || null,
      city: data.city || null,
      logo_url: null,
    })
    .returning();

  return NextResponse.json(
    { user, profile: insertedProfiles[0] },
    { status: 201 }
  );
}
