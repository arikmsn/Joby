import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole, TERMINAL_STATUSES } from "@/lib/constants";
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
    .select({ end_at: shifts.end_at })
    .from(shifts)
    .where(eq(shifts.id, app.shift_id))
    .limit(1);

  if (shiftRows.length > 0 && new Date(shiftRows[0].end_at!) < new Date()) {
    return NextResponse.json(
      { error: "SHIFT_ENDED", message: t("apply.cancel_not_allowed") },
      { status: 400 }
    );
  }

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

  return NextResponse.json({
    application: updated[0],
    message: t("apply.cancel_success"),
  });
}
