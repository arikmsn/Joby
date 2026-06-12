import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { eq, and, gte, lt, sql } from "drizzle-orm";

// GET /api/shifts/employer/dashboard — employer dashboard data
export async function GET(req: NextRequest) {
  const user = await requireRole(req, UserRole.EMPLOYER);
  if (user instanceof NextResponse) return user;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const mine = eq(shifts.employer_id, user.id);

  const [todayShifts, upcomingShifts, counts] = await Promise.all([
    // Today's shifts
    db.select()
      .from(shifts)
      .where(and(mine, gte(shifts.start_at, todayStart), lt(shifts.start_at, todayEnd)))
      .orderBy(shifts.start_at)
      .limit(10),

    // Upcoming 7 days (excluding today)
    db.select()
      .from(shifts)
      .where(and(mine, gte(shifts.start_at, todayEnd), lt(shifts.start_at, weekEnd)))
      .orderBy(shifts.start_at)
      .limit(10),

    // Status counts
    db.select({
      status: shifts.status,
      count: sql<number>`count(*)::int`,
    })
      .from(shifts)
      .where(mine)
      .groupBy(shifts.status),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const c of counts) {
    statusCounts[c.status] = c.count;
  }

  return NextResponse.json({
    today: todayShifts,
    upcoming: upcomingShifts,
    counts: {
      draft: statusCounts[ShiftStatus.DRAFT] || 0,
      published: statusCounts[ShiftStatus.PUBLISHED] || 0,
      cancelled: statusCounts[ShiftStatus.CANCELLED] || 0,
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    },
  });
}
