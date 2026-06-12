import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, shifts } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { decrementSlot } from "@/lib/slots";

// GET /api/cron/flag-unconfirmed
// Cancels approved workers who failed to confirm attendance.
// Confirmation cutoff: 2 hours before shift start.
export async function GET(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const CUTOFF_HOURS = 2;
  const cutoffTime = new Date(Date.now() + CUTOFF_HOURS * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const rows = await db
    .select({
      application_id: applications.id,
      shift_id: applications.shift_id,
      worker_id: applications.worker_id,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(
      and(
        eq(applications.status, "APPROVED"),
        eq(applications.is_backup, false),
        sql`${shifts.start_at} > ${now}`,
        sql`${shifts.start_at} <= ${cutoffTime}`,
        sql`${shifts.status} != 'CANCELLED'`
      )
    );

  let cancelled = 0;
  for (const row of rows) {
    await db
      .update(applications)
      .set({
        status: "CANCELLED_BY_SYSTEM",
        cancelled_at: sql`now()`,
        updated_at: sql`now()`,
      })
      .where(eq(applications.id, row.application_id));

    await decrementSlot(row.shift_id);
    cancelled++;
  }

  return NextResponse.json({
    message: `Cancelled ${cancelled} unconfirmed workers`,
    cancelled,
    total_checked: rows.length,
  });
}
