import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, users, checkinEvents, workerProfiles } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
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

  const shiftRows = await db
    .select({ employer_id: shifts.employer_id, start_at: shifts.start_at, end_at: shifts.end_at, title: shifts.title })
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (shiftRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.shift_not_found") }, { status: 404 });
  }
  if (shiftRows[0].employer_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: t("error.forbidden") }, { status: 403 });
  }

  const activeStatuses = ["APPROVED", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"];
  const appRows = await db
    .select({
      id: applications.id,
      worker_id: applications.worker_id,
      status: applications.status,
      is_backup: applications.is_backup,
      worker_name: users.full_name,
      worker_phone: users.phone,
      worker_trust: workerProfiles.trust_score,
      worker_total_shifts: workerProfiles.total_shifts,
    })
    .from(applications)
    .innerJoin(users, eq(applications.worker_id, users.id))
    .leftJoin(workerProfiles, eq(applications.worker_id, workerProfiles.user_id))
    .where(
      and(
        eq(applications.shift_id, shiftId),
        inArray(applications.status, activeStatuses)
      )
    )
    .orderBy(applications.applied_at);

  const appIds = appRows.map((a) => a.id);
  let events: { application_id: string; event_type: string; source: string; created_at: Date | null }[] = [];
  if (appIds.length > 0) {
    events = await db
      .select({
        application_id: checkinEvents.application_id,
        event_type: checkinEvents.event_type,
        source: checkinEvents.source,
        created_at: checkinEvents.created_at,
      })
      .from(checkinEvents)
      .where(inArray(checkinEvents.application_id, appIds))
      .orderBy(checkinEvents.created_at);
  }

  const attendance = appRows.map((app) => {
    const appEvents = events.filter((e) => e.application_id === app.id);
    const checkIn = appEvents.find((e) => e.event_type === "CHECK_IN");
    const checkOut = appEvents.find((e) => e.event_type === "CHECK_OUT");

    return {
      application_id: app.id,
      worker_id: app.worker_id,
      worker_name: app.worker_name,
      worker_phone: app.worker_phone,
      worker_trust: app.worker_trust,
      worker_total_shifts: app.worker_total_shifts,
      status: app.status,
      is_backup: app.is_backup,
      checked_in_at: checkIn?.created_at || null,
      checked_in_source: checkIn?.source || null,
      checked_out_at: checkOut?.created_at || null,
      checked_out_source: checkOut?.source || null,
    };
  });

  return NextResponse.json({
    shift: { id: shiftId, title: shiftRows[0].title, start_at: shiftRows[0].start_at, end_at: shiftRows[0].end_at },
    attendance,
  });
}
