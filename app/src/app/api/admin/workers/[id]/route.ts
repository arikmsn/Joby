import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, workerProfiles, ratings } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminUpdateWorkerSchema } from "@/lib/validators";
import { UserRole } from "@/lib/constants";
import { eq, and, sql } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// GET /api/admin/workers/:id — worker detail with trust/ratings summary (admin only)
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
      city: workerProfiles.city,
      bio: workerProfiles.bio,
      experience_tags: workerProfiles.experience_tags,
      trust_score: workerProfiles.trust_score,
      total_shifts: workerProfiles.total_shifts,
      no_show_count: workerProfiles.no_show_count,
      cancel_count: workerProfiles.cancel_count,
    })
    .from(users)
    .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
    .where(and(eq(users.id, params.id), eq(users.role, UserRole.WORKER)))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const ratingStats = await db
    .select({
      avg_score: sql<number>`ROUND(AVG(${ratings.score})::numeric, 2)`,
      rating_count: sql<number>`COUNT(*)::int`,
    })
    .from(ratings)
    .where(eq(ratings.worker_id, params.id));

  return NextResponse.json({
    worker: {
      ...rows[0],
      avg_rating: ratingStats[0]?.avg_score || null,
      rating_count: ratingStats[0]?.rating_count || 0,
    },
  });
}

// PATCH /api/admin/workers/:id — edit worker profile / activation (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminUpdateWorkerSchema.safeParse(body);
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
    .where(and(eq(users.id, params.id), eq(users.role, UserRole.WORKER)))
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

  if (data.city !== undefined || data.experience_tags !== undefined || data.bio !== undefined) {
    await db
      .update(workerProfiles)
      .set({
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.experience_tags !== undefined ? { experience_tags: data.experience_tags } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
      })
      .where(eq(workerProfiles.user_id, params.id));
  }

  const rows = await db
    .select({
      id: users.id,
      phone: users.phone,
      full_name: users.full_name,
      is_active: users.is_active,
      created_by_admin: users.created_by_admin,
      created_at: users.created_at,
      city: workerProfiles.city,
      bio: workerProfiles.bio,
      experience_tags: workerProfiles.experience_tags,
      trust_score: workerProfiles.trust_score,
      total_shifts: workerProfiles.total_shifts,
      no_show_count: workerProfiles.no_show_count,
      cancel_count: workerProfiles.cancel_count,
    })
    .from(users)
    .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
    .where(eq(users.id, params.id))
    .limit(1);

  return NextResponse.json({ worker: rows[0] });
}
