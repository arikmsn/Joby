import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, shifts, checkinEvents } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { recalcTrustScore } from "@/lib/trust";
import { Config } from "@/lib/constants";

// GET /api/cron/auto-complete
// 1. Auto-checkout any CHECKED_IN workers whose shift ended + checkout grace
// 2. Mark PUBLISHED shifts as COMPLETED when shift end + grace has passed
//    and all active applications are in terminal/checked-out state
export async function GET(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const graceMinutes = Config.DEFAULT_CHECKOUT_GRACE_MINUTES;
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000).toISOString();

  // 1. Auto-checkout checked-in workers past shift end + grace
  const checkedInRows = await db
    .select({
      application_id: applications.id,
      shift_id: applications.shift_id,
      worker_id: applications.worker_id,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(
      and(
        eq(applications.status, "CHECKED_IN"),
        sql`${shifts.end_at} <= ${cutoff}`
      )
    );

  let autoCheckedOut = 0;
  for (const row of checkedInRows) {
    // Create checkout event
    await db.insert(checkinEvents).values({
      application_id: row.application_id,
      event_type: "CHECK_OUT",
      source: "MANUAL", // system-generated, closest source type
    });

    await db
      .update(applications)
      .set({ status: "CHECKED_OUT", updated_at: sql`now()` })
      .where(eq(applications.id, row.application_id));

    await recalcTrustScore(row.worker_id);
    autoCheckedOut++;
  }

  // 2. Mark eligible shifts as COMPLETED
  // A shift is eligible if: status is PUBLISHED, end_at + grace has passed,
  // and no active (non-terminal, non-checked-out) applications remain
  const eligibleShifts = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(
      and(
        eq(shifts.status, "PUBLISHED"),
        sql`${shifts.end_at} <= ${cutoff}`
      )
    );

  let completed = 0;
  for (const shift of eligibleShifts) {
    // Check if any applications are still in active states
    const activeApps = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.shift_id, shift.id),
          sql`${applications.status} IN ('APPROVED', 'CONFIRMED', 'CHECKED_IN')`
        )
      )
      .limit(1);

    if (activeApps.length === 0) {
      await db
        .update(shifts)
        .set({ status: "COMPLETED", updated_at: sql`now()` })
        .where(eq(shifts.id, shift.id));
      completed++;
    }
  }

  return NextResponse.json({
    message: `Auto-checked-out ${autoCheckedOut} workers, completed ${completed} shifts`,
    autoCheckedOut,
    completed,
  });
}
