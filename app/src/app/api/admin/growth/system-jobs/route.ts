import { NextRequest, NextResponse } from "next/server";
import { withGrowthAuth, isSuperAdmin } from "@/lib/growth/auth";
import { systemJobSchema } from "@/lib/growth/validators";
import { runCollectJob, runClusterJob, runPurgeJob } from "@/lib/growth/runners";
import { GrowthPermission } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

export const maxDuration = 300;

// POST /api/admin/growth/system-jobs — admin-triggered system jobs
// (collect / cluster / purge) — the manual counterpart to the cron routes.
// Restricted to super_admin (these move data platform-wide). Each runner
// writes its own audit row with the actor id.
export const POST = withGrowthAuth(
  GrowthPermission.SOURCES_APPROVE,
  async (req: NextRequest, actor) => {
    if (!isSuperAdmin(actor)) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: t("error.forbidden") },
        { status: 403 }
      );
    }
    const body = await req.json().catch(() => null);
    const parsed = systemJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }

    switch (parsed.data.job) {
      case "collect":
        return NextResponse.json({
          ok: true,
          job: "collect",
          ...(await runCollectJob("manual", actor.id)),
        });
      case "cluster":
        return NextResponse.json({
          ok: true,
          job: "cluster",
          ...(await runClusterJob(actor.id)),
        });
      case "purge":
        return NextResponse.json({
          ok: true,
          job: "purge",
          ...(await runPurgeJob(actor.id)),
        });
    }
  }
);
