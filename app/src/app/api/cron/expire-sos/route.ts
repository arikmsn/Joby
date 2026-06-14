import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sosBroadcasts } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

// GET /api/cron/expire-sos
// Marks active SOS broadcasts past their expires_at as EXPIRED
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  const result = await db
    .update(sosBroadcasts)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(sosBroadcasts.status, "ACTIVE"),
        sql`${sosBroadcasts.expires_at} <= ${now}`
      )
    )
    .returning({ id: sosBroadcasts.id });

  return NextResponse.json({
    message: `Expired ${result.length} SOS broadcasts`,
    expired: result.length,
  });
}
