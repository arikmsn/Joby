import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isGrowthModuleEnabled } from "@/lib/growth/auth";
import { runClusterJob } from "@/lib/growth/runners";

export const maxDuration = 300;

// POST /api/admin/growth/jobs/cluster — nightly rule-based clustering (cron).
// See runClusterJob: structured observations only, ad_worthy job-computed.
export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isGrowthModuleEnabled()) {
    return NextResponse.json({ error: "MODULE_DISABLED" }, { status: 503 });
  }
  const result = await runClusterJob(null);
  return NextResponse.json({ ok: true, ...result });
}
