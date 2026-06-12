import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole, Config } from "@/lib/constants";
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
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const app = appRows[0];

  if (app.worker_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: t("error.forbidden") }, { status: 403 });
  }

  if (app.is_backup) {
    return NextResponse.json({ error: "BACKUP", message: t("confirm.backup_not_allowed") }, { status: 400 });
  }

  if (app.status === "CONFIRMED") {
    return NextResponse.json({ error: "ALREADY", message: t("confirm.already_confirmed") }, { status: 400 });
  }

  if (app.status !== "APPROVED") {
    return NextResponse.json({ error: "NOT_APPROVED", message: t("confirm.not_allowed") }, { status: 400 });
  }

  // Check confirmation window
  const shiftRows = await db
    .select({ start_at: shifts.start_at })
    .from(shifts)
    .where(eq(shifts.id, app.shift_id))
    .limit(1);

  if (shiftRows.length > 0) {
    const shiftStart = new Date(shiftRows[0].start_at!);
    const windowMs = Config.DEFAULT_CONFIRMATION_WINDOW_HOURS * 3600000;
    const windowOpens = new Date(shiftStart.getTime() - windowMs);
    const now = new Date();

    if (now < windowOpens) {
      return NextResponse.json({ error: "WINDOW", message: t("confirm.window_closed") }, { status: 400 });
    }
    if (now > shiftStart) {
      return NextResponse.json({ error: "WINDOW", message: t("confirm.window_closed") }, { status: 400 });
    }
  }

  const updated = await db
    .update(applications)
    .set({ status: "CONFIRMED", updated_at: sql`now()` })
    .where(eq(applications.id, appId))
    .returning();

  return NextResponse.json({ application: updated[0], message: t("confirm.success") });
}
