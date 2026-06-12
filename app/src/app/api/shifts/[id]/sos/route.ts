import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { shifts, applications, sosBroadcasts, workerProfiles, users } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const shiftId = params.id;

  // Get shift
  const shiftRows = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
  if (shiftRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.shift_not_found") }, { status: 404 });
  }
  const shift = shiftRows[0];

  // Must own the shift
  if (shift.employer_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: t("error.forbidden") }, { status: 403 });
  }

  // Must be PUBLISHED or IN_PROGRESS
  if (shift.status !== "PUBLISHED" && shift.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "NOT_ACTIVE", message: t("sos.shift_not_active") }, { status: 400 });
  }

  // Must have unfilled slots
  const slotsNeeded = (shift.workers_needed ?? 1) - (shift.slots_filled ?? 0);
  if (slotsNeeded <= 0) {
    return NextResponse.json({ error: "FULL", message: t("sos.shift_full") }, { status: 400 });
  }

  // Check no active SOS already
  const existingSos = await db
    .select({ id: sosBroadcasts.id })
    .from(sosBroadcasts)
    .where(and(eq(sosBroadcasts.shift_id, shiftId), eq(sosBroadcasts.status, "ACTIVE")))
    .limit(1);

  if (existingSos.length > 0) {
    return NextResponse.json({ error: "ALREADY_ACTIVE", message: t("sos.already_active") }, { status: 409 });
  }

  // Find workers who already have an application for this shift
  const existingAppWorkers = await db
    .select({ worker_id: applications.worker_id })
    .from(applications)
    .where(eq(applications.shift_id, shiftId));

  const excludeWorkerIds = existingAppWorkers.map((r) => r.worker_id);

  // Find eligible workers:
  // - role = worker, is_active = true
  // - trust_score >= shift.min_trust_score
  // - no existing application for this shift
  // - no overlapping approved/confirmed shifts
  const minTrust = parseFloat(shift.min_trust_score?.toString() || "0");

  const eligibleQuery = db
    .select({
      user_id: workerProfiles.user_id,
      trust_score: workerProfiles.trust_score,
    })
    .from(workerProfiles)
    .innerJoin(users, eq(workerProfiles.user_id, users.id))
    .where(
      and(
        eq(users.role, "worker"),
        eq(users.is_active, true),
        sql`CAST(${workerProfiles.trust_score} AS NUMERIC) >= ${minTrust}`
      )
    )
    .orderBy(sql`${workerProfiles.trust_score} DESC`)
    .limit(50);

  const eligible = await eligibleQuery;

  // Filter out workers with existing applications and overlapping shifts
  const shiftStart = new Date(shift.start_at!);
  const shiftEnd = new Date(shift.end_at!);
  const finalEligible: string[] = [];

  for (const w of eligible) {
    if (excludeWorkerIds.includes(w.user_id)) continue;

    // Check overlap: any non-terminal application with overlapping time
    const overlapping = await db
      .select({ id: applications.id })
      .from(applications)
      .innerJoin(shifts, eq(applications.shift_id, shifts.id))
      .where(
        and(
          eq(applications.worker_id, w.user_id),
          sql`${applications.status} IN ('APPROVED', 'CONFIRMED', 'CHECKED_IN')`,
          sql`${shifts.start_at} < ${shiftEnd.toISOString()}`,
          sql`${shifts.end_at} > ${shiftStart.toISOString()}`
        )
      )
      .limit(1);

    if (overlapping.length === 0) {
      finalEligible.push(w.user_id);
    }
  }

  // Create SOS broadcast
  const sosExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  const inserted = await db
    .insert(sosBroadcasts)
    .values({
      shift_id: shiftId,
      employer_id: user.id,
      slots_needed: slotsNeeded,
      sent_to_count: finalEligible.length,
      status: "ACTIVE",
      expires_at: sosExpiry,
    })
    .returning();

  // Mark shift as having active SOS (store in shift metadata or just rely on join)
  // For MVP, the worker feed will check for active SOS broadcasts

  return NextResponse.json({
    sos: inserted[0],
    eligible_count: finalEligible.length,
    message: t("sos.success"),
  }, { status: 201 });
}
