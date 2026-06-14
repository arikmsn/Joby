import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, applications, notifications } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { eq, and, gte, lt, sql, inArray } from "drizzle-orm";

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

  const [todayShifts, upcomingShifts, counts, cancellationAlerts] = await Promise.all([
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

    // Unread cancellation alerts
    db.select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      payload: notifications.payload,
      created_at: notifications.created_at,
    })
      .from(notifications)
      .where(and(eq(notifications.user_id, user.id), eq(notifications.type, "SHIFT_CANCELLATION"), eq(notifications.is_read, false)))
      .orderBy(notifications.created_at)
      .limit(10),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const c of counts) {
    statusCounts[c.status] = c.count;
  }

  // Applicant activity (pending / backup) for the shifts shown on the dashboard
  const shiftIds = [...todayShifts, ...upcomingShifts].map((s) => s.id);
  const applicantCounts = new Map<string, { pending_count: number; backup_count: number }>();
  if (shiftIds.length > 0) {
    const countRows = await db
      .select({
        shift_id: applications.shift_id,
        status: applications.status,
        is_backup: applications.is_backup,
        count: sql<number>`count(*)::int`,
      })
      .from(applications)
      .where(inArray(applications.shift_id, shiftIds))
      .groupBy(applications.shift_id, applications.status, applications.is_backup);

    for (const row of countRows) {
      const entry = applicantCounts.get(row.shift_id) || { pending_count: 0, backup_count: 0 };
      if (row.status === "PENDING") entry.pending_count += row.count;
      if (row.is_backup && (row.status === "APPROVED" || row.status === "CONFIRMED")) entry.backup_count += row.count;
      applicantCounts.set(row.shift_id, entry);
    }
  }

  const withApplicants = (list: typeof todayShifts) =>
    list.map((s) => ({ ...s, applicants: applicantCounts.get(s.id) || { pending_count: 0, backup_count: 0 } }));

  return NextResponse.json({
    today: withApplicants(todayShifts),
    upcoming: withApplicants(upcomingShifts),
    cancellation_alerts: cancellationAlerts,
    counts: {
      draft: statusCounts[ShiftStatus.DRAFT] || 0,
      published: statusCounts[ShiftStatus.PUBLISHED] || 0,
      cancelled: statusCounts[ShiftStatus.CANCELLED] || 0,
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    },
  });
}
