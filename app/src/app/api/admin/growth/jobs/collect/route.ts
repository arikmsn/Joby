import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isGrowthModuleEnabled } from "@/lib/growth/auth";
import { runCollectJob } from "@/lib/growth/runners";

export const maxDuration = 300;

// POST /api/admin/growth/jobs/collect — scheduled collector run (cron).
// Picks due, approved, collectable channels inside their preferred hours
// window, stalest-first (see runCollectJob). Raw items land in the human
// review queue (no AI). Every run is audited with counts only.
export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isGrowthModuleEnabled()) {
    return NextResponse.json({ error: "MODULE_DISABLED" }, { status: 503 });
  }

  const result = await runCollectJob("cron", null);
  return NextResponse.json({ ok: true, ...result });
}
