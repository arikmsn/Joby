import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isGrowthModuleEnabled } from "@/lib/growth/auth";
import { runPurgeJob } from "@/lib/growth/runners";

// POST /api/admin/growth/jobs/purge — nightly raw-text TTL purge (cron).
// See runPurgeJob: source ad text never retained past RAW_TEXT_TTL_DAYS.
export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isGrowthModuleEnabled()) {
    return NextResponse.json({ error: "MODULE_DISABLED" }, { status: 503 });
  }
  const result = await runPurgeJob(null);
  return NextResponse.json({ ok: true, ...result });
}
