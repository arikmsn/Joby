import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, notifications, workerProfiles, incidents } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import {
  UserRole,
  TERMINAL_STATUSES,
  Config,
  IncidentType,
  IncidentStatus,
  IncidentSeverity,
} from "@/lib/constants";
import { decrementSlot } from "@/lib/slots";
import { recalcTrustScore } from "@/lib/trust";
import { t } from "@/lib/i18n/he";
import { sql } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const appId = params.id;

  const appRows = await db
    .select()
    .from(applications)
    .where(eq(applications.id, appId))
    .limit(1);

  if (appRows.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.not_found") },
      { status: 404 }
    );
  }

  const app = appRows[0];

  if (app.worker_id !== user.id) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: t("error.forbidden") },
      { status: 403 }
    );
  }

  if ((TERMINAL_STATUSES as string[]).includes(app.status)) {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: t("apply.cancel_not_allowed") },
      { status: 400 }
    );
  }

  const shiftRows = await db
    .select({
      start_at: shifts.start_at,
      end_at: shifts.end_at,
      employer_id: shifts.employer_id,
      title: shifts.title,
    })
    .from(shifts)
    .where(eq(shifts.id, app.shift_id))
    .limit(1);

  if (shiftRows.length > 0 && new Date(shiftRows[0].end_at!) < new Date()) {
    return NextResponse.json(
      { error: "SHIFT_ENDED", message: t("apply.cancel_not_allowed") },
      { status: 400 }
    );
  }

  const shift = shiftRows[0];
  const wasActive = app.status === "APPROVED" || app.status === "CONFIRMED";
  const hoursUntilStart = shift
    ? (new Date(shift.start_at!).getTime() - Date.now()) / (1000 * 60 * 60)
    : null;
  const isLate = wasActive && hoursUntilStart !== null && hoursUntilStart <= Config.LATE_CANCEL_WINDOW_HOURS;

  // If was active approved, decrement slot
  if (app.status === "APPROVED" && !app.is_backup) {
    await decrementSlot(app.shift_id);
  }

  const updated = await db
    .update(applications)
    .set({
      status: "CANCELLED_BY_WORKER",
      cancelled_at: sql`now()`,
      updated_at: sql`now()`,
    })
    .where(eq(applications.id, appId))
    .returning();

  // Recalc trust after cancel
  await recalcTrustScore(user.id);

  // Notify employer of cancellation
  if (shift) {
    await db.insert(notifications).values({
      user_id: shift.employer_id,
      type: "SHIFT_CANCELLATION",
      title: t("notification.cancellation.title"),
      body: t("notification.cancellation.body").replace("{title}", shift.title),
      payload: { shift_id: app.shift_id, application_id: app.id, late: isLate },
    });
  }

  // Late-cancel tracking
  if (isLate) {
    const profileRows = await db
      .update(workerProfiles)
      .set({ late_cancel_count: sql`${workerProfiles.late_cancel_count} + 1` })
      .where(eq(workerProfiles.user_id, user.id))
      .returning({ late_cancel_count: workerProfiles.late_cancel_count });

    const lateCancelCount = profileRows[0]?.late_cancel_count ?? 0;

    if (lateCancelCount >= Config.LATE_CANCEL_REVIEW_THRESHOLD) {
      const existingIncident = await db
        .select({ id: incidents.id })
        .from(incidents)
        .where(
          and(
            eq(incidents.related_user_id, user.id),
            eq(incidents.incident_type, IncidentType.MANUAL_REVIEW),
            eq(incidents.status, IncidentStatus.OPEN)
          )
        )
        .limit(1);

      if (existingIncident.length === 0) {
        await db.insert(incidents).values({
          incident_type: IncidentType.MANUAL_REVIEW,
          severity: IncidentSeverity.MEDIUM,
          status: IncidentStatus.OPEN,
          title: t("incident.late_cancel.title"),
          description: t("incident.late_cancel.description").replace(
            "{count}",
            String(lateCancelCount)
          ),
          related_user_id: user.id,
          related_application_id: app.id,
        });
      }
    }
  }

  return NextResponse.json({
    application: updated[0],
    message: t("apply.cancel_success"),
    late_cancel: isLate,
  });
}
