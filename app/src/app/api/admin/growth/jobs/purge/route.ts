import { NextResponse } from "next/server";
import { sql, and, lt, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceJobs } from "@/lib/schema";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { isGrowthModuleEnabled } from "@/lib/growth/auth";
import { GrowthAuditAction } from "@/lib/constants";

// POST /api/admin/growth/jobs/purge — nightly raw-text TTL purge (cron).
// Guardrail: source ad text is never retained past RAW_TEXT_TTL_DAYS.
// Extracted facts remain; only raw_text is nulled. Every run is audited.
export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isGrowthModuleEnabled()) {
    return NextResponse.json({ error: "MODULE_DISABLED" }, { status: 503 });
  }

  const result = await db
    .update(sourceJobs)
    .set({ raw_text: null, raw_text_expires_at: null, updated_at: new Date() })
    .where(
      and(
        isNotNull(sourceJobs.raw_text),
        lt(sourceJobs.raw_text_expires_at, sql`now()`)
      )
    )
    .returning({ id: sourceJobs.id });

  await logGrowthAudit({
    actor_id: null,
    action: GrowthAuditAction.PURGE_RUN,
    entity_type: "source_jobs",
    reason: `purged raw_text on ${result.length} row(s)`,
  });

  return NextResponse.json({ ok: true, purged: result.length });
}
