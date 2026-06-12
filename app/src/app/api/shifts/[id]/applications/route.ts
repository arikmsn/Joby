import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, users, workerProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const shiftId = params.id;

  // Verify this shift belongs to the employer
  const shiftRows = await db
    .select({ employer_id: shifts.employer_id })
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (shiftRows.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.shift_not_found") },
      { status: 404 }
    );
  }

  if (shiftRows[0].employer_id !== user.id) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: t("error.forbidden") },
      { status: 403 }
    );
  }

  // Get applications with worker info
  const rows = await db
    .select({
      id: applications.id,
      shift_id: applications.shift_id,
      worker_id: applications.worker_id,
      status: applications.status,
      is_backup: applications.is_backup,
      applied_at: applications.applied_at,
      approved_at: applications.approved_at,
      rejected_at: applications.rejected_at,
      cancelled_at: applications.cancelled_at,
      worker_name: users.full_name,
      worker_phone: users.phone,
      worker_city: workerProfiles.city,
      worker_trust: workerProfiles.trust_score,
    })
    .from(applications)
    .innerJoin(users, eq(applications.worker_id, users.id))
    .leftJoin(workerProfiles, eq(applications.worker_id, workerProfiles.user_id))
    .where(eq(applications.shift_id, shiftId))
    .orderBy(applications.applied_at);

  return NextResponse.json({ applications: rows });
}
