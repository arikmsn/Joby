import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, shifts } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

// GET /api/cron/request-confirmations
// Finds APPROVED non-backup applications for shifts starting within 24h.
// MVP: returns the list. Production would send push notifications.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      application_id: applications.id,
      worker_id: applications.worker_id,
      shift_id: applications.shift_id,
      shift_title: shifts.title,
      shift_start: shifts.start_at,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(
      and(
        eq(applications.status, "APPROVED"),
        eq(applications.is_backup, false),
        sql`${shifts.start_at} > ${now}`,
        sql`${shifts.start_at} <= ${in24h}`,
        sql`${shifts.status} != 'CANCELLED'`
      )
    );

  return NextResponse.json({
    message: `Found ${rows.length} workers to notify for confirmation`,
    workers: rows,
  });
}
