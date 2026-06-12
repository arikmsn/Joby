import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ratings, shifts, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const workerId = params.id;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

  const rows = await db
    .select({
      id: ratings.id,
      score: ratings.score,
      flag: ratings.flag,
      comment: ratings.comment,
      created_at: ratings.created_at,
      shift_title: shifts.title,
      shift_start_at: shifts.start_at,
      employer_name: users.full_name,
    })
    .from(ratings)
    .innerJoin(shifts, eq(ratings.shift_id, shifts.id))
    .innerJoin(users, eq(ratings.employer_id, users.id))
    .where(eq(ratings.worker_id, workerId))
    .orderBy(desc(ratings.created_at))
    .limit(limit);

  return NextResponse.json({ ratings: rows });
}
