import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, users, workerProfiles, employerWorkerRelations } from "@/lib/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { UserRole, PAYABLE_STATUSES } from "@/lib/constants";

// GET /api/employers/known-workers — workers who previously worked for this employer
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const workedRows = await db
    .select({
      worker_id: applications.worker_id,
      times_worked: sql<number>`count(*)::int`,
      last_worked_at: sql<string>`max(${shifts.start_at})`,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(and(eq(shifts.employer_id, user.id), inArray(applications.status, PAYABLE_STATUSES)))
    .groupBy(applications.worker_id);

  if (workedRows.length === 0) {
    return NextResponse.json({ workers: [] });
  }

  const workerIds = workedRows.map((r) => r.worker_id);

  const [profileRows, relationRows] = await Promise.all([
    db
      .select({
        id: users.id,
        full_name: users.full_name,
        phone: users.phone,
        city: workerProfiles.city,
        trust_score: workerProfiles.trust_score,
        total_shifts: workerProfiles.total_shifts,
        experience_tags: workerProfiles.experience_tags,
      })
      .from(users)
      .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
      .where(inArray(users.id, workerIds)),
    db
      .select({
        worker_id: employerWorkerRelations.worker_id,
        is_preferred: employerWorkerRelations.is_preferred,
      })
      .from(employerWorkerRelations)
      .where(and(eq(employerWorkerRelations.employer_id, user.id), inArray(employerWorkerRelations.worker_id, workerIds))),
  ]);

  const profileMap = new Map(profileRows.map((p) => [p.id, p]));
  const preferredSet = new Set(relationRows.filter((r) => r.is_preferred).map((r) => r.worker_id));

  const workers = workedRows
    .map((w) => {
      const profile = profileMap.get(w.worker_id);
      if (!profile) return null;
      return {
        ...profile,
        times_worked: w.times_worked,
        last_worked_at: w.last_worked_at,
        is_preferred: preferredSet.has(w.worker_id),
      };
    })
    .filter((w): w is NonNullable<typeof w> => w !== null)
    .sort((a, b) => {
      if (a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1;
      return new Date(b.last_worked_at).getTime() - new Date(a.last_worked_at).getTime();
    });

  return NextResponse.json({ workers });
}
