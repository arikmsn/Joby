import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, checkinEvents, shifts } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { UserRole, Config } from "@/lib/constants";
import { validateQrToken } from "@/lib/qr";
import { t } from "@/lib/i18n/he";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const body = await req.json().catch(() => null);
  if (!body?.token) {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = await validateQrToken(body.token);
  if (!parsed) {
    return NextResponse.json({ error: "INVALID_QR", message: t("qr.invalid_token") }, { status: 400 });
  }

  const { shiftId, mode } = parsed;

  const appRows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.shift_id, shiftId), eq(applications.worker_id, user.id)))
    .limit(1);

  if (appRows.length === 0) {
    return NextResponse.json({ error: "NO_APP", message: t("qr.error.not_approved") }, { status: 403 });
  }

  const app = appRows[0];
  const currentStatus = app.status as string;

  if (mode === "CHECK_IN") {
    if (currentStatus === "CHECKED_IN") {
      return NextResponse.json({ error: "ALREADY_IN", message: t("checkin.already_in") }, { status: 400 });
    }
    if (currentStatus !== "APPROVED" && currentStatus !== "CONFIRMED") {
      return NextResponse.json({ error: "NOT_APPROVED", message: t("checkin.not_allowed") }, { status: 400 });
    }
    if (app.is_backup) {
      return NextResponse.json({ error: "BACKUP", message: t("checkin.not_allowed") }, { status: 400 });
    }

    const shiftRows = await db.select({ start_at: shifts.start_at, end_at: shifts.end_at }).from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    if (shiftRows.length > 0) {
      const now = new Date();
      const start = new Date(shiftRows[0].start_at!);
      const end = new Date(shiftRows[0].end_at!);
      const graceMs = Config.DEFAULT_CHECKIN_GRACE_MINUTES * 60000;
      if (now < new Date(start.getTime() - graceMs) || now > end) {
        return NextResponse.json({ error: "WINDOW", message: t("checkin.window_error") }, { status: 400 });
      }
    }

    await db.insert(checkinEvents).values({
      application_id: app.id,
      event_type: "CHECK_IN",
      source: "QR",
    });

    await db.update(applications).set({ status: "CHECKED_IN", updated_at: sql`now()` }).where(eq(applications.id, app.id));

    return NextResponse.json({ message: t("checkin.success"), status: "CHECKED_IN" });
  }

  if (mode === "CHECK_OUT") {
    if (currentStatus !== "CHECKED_IN") {
      return NextResponse.json({ error: "NOT_CHECKED_IN", message: t("checkout.not_checked_in") }, { status: 400 });
    }

    await db.insert(checkinEvents).values({
      application_id: app.id,
      event_type: "CHECK_OUT",
      source: "QR",
    });

    await db.update(applications).set({ status: "CHECKED_OUT", updated_at: sql`now()` }).where(eq(applications.id, app.id));

    return NextResponse.json({ message: t("checkout.success"), status: "CHECKED_OUT" });
  }

  return NextResponse.json({ error: "INVALID", message: t("error.validation") }, { status: 400 });
}
