import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, shifts } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { decrementSlot } from "@/lib/slots";
import { recalcTrustScore } from "@/lib/trust";
import { Config } from "@/lib/constants";

// GET /api/cron/flag-noshows
// Marks active approved/confirmed (non-backup) workers as NO_SHOW
// if the shift is past start + grace window and they never checked in.
export async function GET(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const graceMinutes = Config.DEFAULT_CHECKIN_GRACE_MINUTES;
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000).toISOString();

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
        sql`${applications.status} IN ('APPROVED', 'CONFIRMED')`,
        eq(applications.is_backup, false),
        sql`${shifts.start_at} <= ${cutoff}`,
        sql`${shifts.status} != 'CANCELLED'`
      )
    );

  let flagged = 0;
  for (const row of rows) {
    await db
      .update(applications)
      .set({ status: "NO_SHOW", updated_at: sql`now()` })
      .where(eq(applications.id, row.application_id));

    await decrementSlot(row.shift_id);
    await recalcTrustScore(row.worker_id);
    flagged++;
  }

  return NextResponse.json({ message: `Flagged ${flagged} no-shows`, flagged });
}
