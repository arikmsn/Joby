import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, notifications, employerProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { approveApplicationSchema } from "@/lib/validators";
import { incrementSlot } from "@/lib/slots";
import { t } from "@/lib/i18n/he";
import { sql } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const parsed = approveApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }

  const { status: newStatus, is_backup } = parsed.data;
  const appId = params.id;

  // Get application with shift info
  const appRows = await db
    .select({
      id: applications.id,
      shift_id: applications.shift_id,
      worker_id: applications.worker_id,
      status: applications.status,
      is_backup: applications.is_backup,
    })
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

  // Verify employer owns the shift
  const shiftRows = await db
    .select({ employer_id: shifts.employer_id, title: shifts.title, start_at: shifts.start_at })
    .from(shifts)
    .where(eq(shifts.id, app.shift_id))
    .limit(1);

  if (shiftRows.length === 0 || shiftRows[0].employer_id !== user.id) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: t("error.forbidden") },
      { status: 403 }
    );
  }

  const shift = shiftRows[0];

  // Only PENDING applications can be approved/rejected
  if (app.status !== "PENDING") {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: t("error.invalid_transition") },
      { status: 400 }
    );
  }

  if (newStatus === "APPROVED") {
    const isBackup = is_backup === true;

    if (!isBackup) {
      // Active approval — try to increment slot
      const slotOk = await incrementSlot(app.shift_id);
      if (!slotOk) {
        return NextResponse.json(
          { error: "SLOTS_FULL", message: t("applicants.slots_full") },
          { status: 409 }
        );
      }
    }

    const updated = await db
      .update(applications)
      .set({
        status: "APPROVED",
        is_backup: isBackup,
        approved_at: sql`now()`,
        updated_at: sql`now()`,
      })
      .where(eq(applications.id, appId))
      .returning();

    const employerRows = await db
      .select({ business_name: employerProfiles.business_name })
      .from(employerProfiles)
      .where(eq(employerProfiles.user_id, user.id))
      .limit(1);
    const employerName = employerRows[0]?.business_name || "";

    const shiftDate = new Date(shift.start_at).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    await db.insert(notifications).values({
      user_id: app.worker_id,
      type: "APPLICATION_APPROVED",
      title: t("notification.approval.title"),
      body: t("notification.approval.body")
        .replace("{employer}", employerName)
        .replace("{title}", shift.title)
        .replace("{date}", shiftDate),
      payload: { shift_id: app.shift_id, application_id: appId },
      channel: "in_app",
    });

    return NextResponse.json({ application: updated[0] });
  }

  if (newStatus === "REJECTED") {
    const updated = await db
      .update(applications)
      .set({
        status: "REJECTED",
        rejected_at: sql`now()`,
        updated_at: sql`now()`,
      })
      .where(eq(applications.id, appId))
      .returning();

    return NextResponse.json({ application: updated[0] });
  }

  return NextResponse.json(
    { error: "INVALID_STATUS", message: t("error.validation") },
    { status: 400 }
  );
}
