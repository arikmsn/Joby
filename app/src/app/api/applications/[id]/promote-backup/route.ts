import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { incrementSlot } from "@/lib/slots";
import { t } from "@/lib/i18n/he";
import { sql } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const appId = params.id;

  // Get application
  const appRows = await db.select().from(applications).where(eq(applications.id, appId)).limit(1);
  if (appRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }
  const app = appRows[0];

  // Must be a backup
  if (!app.is_backup) {
    return NextResponse.json({ error: "NOT_BACKUP", message: t("backup.not_backup") }, { status: 400 });
  }

  // Must be APPROVED status
  if (app.status !== "APPROVED") {
    return NextResponse.json({ error: "INVALID_STATUS", message: t("backup.not_backup") }, { status: 400 });
  }

  // Verify employer owns the shift
  const shiftRows = await db
    .select({ employer_id: shifts.employer_id })
    .from(shifts)
    .where(eq(shifts.id, app.shift_id))
    .limit(1);

  if (shiftRows.length === 0 || shiftRows[0].employer_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: t("error.forbidden") }, { status: 403 });
  }

  // Atomically increment slot (fails if full)
  const slotOk = await incrementSlot(app.shift_id);
  if (!slotOk) {
    return NextResponse.json({ error: "SLOTS_FULL", message: t("backup.slots_full") }, { status: 400 });
  }

  // Flip is_backup to false
  const updated = await db
    .update(applications)
    .set({
      is_backup: false,
      updated_at: sql`now()`,
    })
    .where(eq(applications.id, appId))
    .returning();

  return NextResponse.json({
    application: updated[0],
    message: t("backup.promote_success"),
  });
}
