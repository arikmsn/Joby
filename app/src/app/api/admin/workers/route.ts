import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, workerProfiles } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminCreateWorkerSchema, adminListQuerySchema } from "@/lib/validators";
import { UserRole, Config } from "@/lib/constants";
import { eq, or, ilike, and, sql, desc } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// GET /api/admin/workers — list/search workers (admin only)
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

  const conditions = [eq(users.role, UserRole.WORKER)];
  if (q) {
    conditions.push(
      or(
        ilike(users.full_name, `%${q}%`),
        ilike(workerProfiles.city, `%${q}%`),
        sql`EXISTS (SELECT 1 FROM unnest(${workerProfiles.experience_tags}) tag WHERE tag ILIKE ${`%${q}%`})`
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
        city: workerProfiles.city,
        experience_tags: workerProfiles.experience_tags,
        trust_score: workerProfiles.trust_score,
        total_shifts: workerProfiles.total_shifts,
      })
      .from(users)
      .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
      .where(where)
      .orderBy(desc(users.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
      .where(where),
  ]);

  return NextResponse.json({
    data: rows,
    total: countResult[0]?.count || 0,
    page,
    limit,
  });
}

// POST /api/admin/workers — create a new worker account (admin only)
export async function POST(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminCreateWorkerSchema.safeParse(body);
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
      role: UserRole.WORKER,
      created_by_admin: true,
    })
    .returning();
  const user = insertedUsers[0];

  const insertedProfiles = await db
    .insert(workerProfiles)
    .values({
      user_id: user.id,
      city: data.city || null,
      experience_tags: data.experience_tags || [],
      bio: data.bio || null,
      trust_score: Config.TRUST_BASE_SCORE.toString(),
    })
    .returning();

  return NextResponse.json({ user, profile: insertedProfiles[0] }, { status: 201 });
}
