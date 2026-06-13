import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  shifts,
  applications,
  sosBroadcasts,
  incidents,
} from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/constants";
import { eq, sql } from "drizzle-orm";

// GET /api/admin/overview — platform-wide counters (admin only)
export async function GET(req: NextRequest) {
  const user = await requireRole(req, UserRole.ADMIN);
  if (user instanceof NextResponse) return user;

  const [
    employerCount,
    workerCount,
    shiftsByStatus,
    pendingApplications,
    activeSos,
    openIncidents,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, UserRole.EMPLOYER)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, UserRole.WORKER)),
    db
      .select({
        status: shifts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(shifts)
      .groupBy(shifts.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(eq(applications.status, "PENDING")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sosBroadcasts)
      .where(eq(sosBroadcasts.status, "ACTIVE")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidents)
      .where(eq(incidents.status, "OPEN")),
  ]);

  const shiftCounts: Record<string, number> = {
    DRAFT: 0,
    PUBLISHED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  let totalShifts = 0;
  for (const row of shiftsByStatus) {
    shiftCounts[row.status] = row.count;
    totalShifts += row.count;
  }

  return NextResponse.json({
    employers: employerCount[0]?.count || 0,
    workers: workerCount[0]?.count || 0,
    shifts: {
      total: totalShifts,
      by_status: shiftCounts,
    },
    pending_applications: pendingApplications[0]?.count || 0,
    active_sos: activeSos[0]?.count || 0,
    open_incidents: openIncidents[0]?.count || 0,
  });
}
