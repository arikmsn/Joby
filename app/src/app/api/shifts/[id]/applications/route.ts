import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, users, workerProfiles } from "@/lib/schema";
import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { UserRole, PAYABLE_STATUSES } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

const HIGH_TRUST_THRESHOLD = 4.5;

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
    .select({
      employer_id: shifts.employer_id,
      role_tag: shifts.role_tag,
      city: shifts.city,
    })
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (shiftRows.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.shift_not_found") },
      { status: 404 }
    );
  }

  const targetShift = shiftRows[0];
  if (targetShift.employer_id !== user.id) {
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
      worker_experience_tags: workerProfiles.experience_tags,
    })
    .from(applications)
    .innerJoin(users, eq(applications.worker_id, users.id))
    .leftJoin(workerProfiles, eq(applications.worker_id, workerProfiles.user_id))
    .where(eq(applications.shift_id, shiftId))
    .orderBy(applications.applied_at);

  const workerIds = Array.from(new Set(rows.map((r) => r.worker_id)));
  let workedBeforeMap = new Map<string, number>();
  let completedSimilarMap = new Map<string, number>();

  if (workerIds.length > 0) {
    const [workedBeforeRows, completedSimilarRows] = await Promise.all([
      // How many times each applicant has previously completed shifts for THIS employer
      db
        .select({
          worker_id: applications.worker_id,
          count: sql<number>`count(*)::int`,
        })
        .from(applications)
        .innerJoin(shifts, eq(applications.shift_id, shifts.id))
        .where(
          and(
            eq(shifts.employer_id, user.id),
            inArray(applications.worker_id, workerIds),
            inArray(applications.status, PAYABLE_STATUSES),
            ne(applications.shift_id, shiftId)
          )
        )
        .groupBy(applications.worker_id),

      // How many times each applicant has completed shifts with the same role (any employer)
      db
        .select({
          worker_id: applications.worker_id,
          count: sql<number>`count(*)::int`,
        })
        .from(applications)
        .innerJoin(shifts, eq(applications.shift_id, shifts.id))
        .where(
          and(
            eq(shifts.role_tag, targetShift.role_tag),
            inArray(applications.worker_id, workerIds),
            inArray(applications.status, PAYABLE_STATUSES),
            ne(applications.shift_id, shiftId)
          )
        )
        .groupBy(applications.worker_id),
    ]);

    workedBeforeMap = new Map(workedBeforeRows.map((r) => [r.worker_id, r.count]));
    completedSimilarMap = new Map(completedSimilarRows.map((r) => [r.worker_id, r.count]));
  }

  const result = rows.map((r) => {
    const workedBeforeCount = workedBeforeMap.get(r.worker_id) || 0;
    const completedSimilarCount = completedSimilarMap.get(r.worker_id) || 0;
    const trustScore = parseFloat(r.worker_trust?.toString() || "0");

    const reasons: string[] = [];
    if (workedBeforeCount > 0) reasons.push(t("applicants.reason.worked_before"));
    if (
      r.worker_experience_tags?.includes(targetShift.role_tag) ||
      completedSimilarCount > 0
    ) {
      reasons.push(t("applicants.reason.matches_role"));
    }
    if (r.worker_city && targetShift.city && r.worker_city === targetShift.city) {
      reasons.push(t("applicants.reason.same_city"));
    }
    if (trustScore >= HIGH_TRUST_THRESHOLD) {
      reasons.push(t("applicants.reason.high_trust"));
    }
    if (completedSimilarCount > 0) {
      reasons.push(t("applicants.reason.completed_similar"));
    }

    const { worker_experience_tags, ...rest } = r;
    void worker_experience_tags;

    return {
      ...rest,
      worked_before_count: workedBeforeCount,
      recommendation_reasons: reasons,
    };
  });

  return NextResponse.json({ applications: result });
}
