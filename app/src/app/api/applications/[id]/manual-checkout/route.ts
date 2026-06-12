import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, checkinEvents, shifts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
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

  const appRows = await db.select().from(applications).where(eq(applications.id, appId)).limit(1);
  if (appRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const app = appRows[0];

  const shiftRows = await db.select({ employer_id: shifts.employer_id }).from(shifts).where(eq(shifts.id, app.shift_id)).limit(1);
  if (shiftRows.length === 0 || shiftRows[0].employer_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: t("error.forbidden") }, { status: 403 });
  }

  if (app.status !== "CHECKED_IN") {
    return NextResponse.json({ error: "NOT_CHECKED_IN", message: t("checkout.not_checked_in") }, { status: 400 });
  }

  await db.insert(checkinEvents).values({
    application_id: app.id,
    event_type: "CHECK_OUT",
    source: "MANUAL",
    scanned_by_user_id: user.id,
  });

  await db.update(applications).set({ status: "CHECKED_OUT", updated_at: sql`now()` }).where(eq(applications.id, appId));

  return NextResponse.json({ message: t("checkout.success"), status: "CHECKED_OUT" });
}
