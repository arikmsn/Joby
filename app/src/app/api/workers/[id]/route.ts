import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, workerProfiles, ratings } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const workerId = params.id;

  // Get user + worker profile
  const rows = await db
    .select({
      id: users.id,
      full_name: users.full_name,
      avatar_url: users.avatar_url,
      role: users.role,
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
    .where(eq(users.id, workerId))
    .limit(1);

  if (rows.length === 0 || rows[0].role !== "worker") {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.not_found") },
      { status: 404 }
    );
  }

  // Get avg rating and count
  const ratingStats = await db
    .select({
      avg_score: sql<number>`ROUND(AVG(${ratings.score})::numeric, 2)`,
      rating_count: sql<number>`COUNT(*)::int`,
    })
    .from(ratings)
    .where(eq(ratings.worker_id, workerId));

  const profile = rows[0];
  return NextResponse.json({
    worker: {
      ...profile,
      avg_rating: ratingStats[0]?.avg_score || null,
      rating_count: ratingStats[0]?.rating_count || 0,
    },
  });
}
