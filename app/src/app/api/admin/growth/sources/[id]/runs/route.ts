import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectorRuns } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { runsFilterSchema } from "@/lib/growth/validators";
import { GrowthPermission } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// GET /api/admin/growth/sources/[id]/runs — per-source run history
export const GET = withGrowthAuth(
  GrowthPermission.SOURCES_READ,
  async (req: NextRequest, _actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }
    const url = new URL(req.url);
    const parsed = runsFilterSchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: collectorRuns.id,
          job: collectorRuns.job,
          trigger: collectorRuns.trigger,
          status: collectorRuns.status,
          started_at: collectorRuns.started_at,
          finished_at: collectorRuns.finished_at,
          pages_crawled: collectorRuns.pages_crawled,
          urls_discovered: collectorRuns.urls_discovered,
          items_ingested: collectorRuns.items_ingested,
          duplicates: collectorRuns.duplicates,
          filtered_out: collectorRuns.filtered_out,
          error: collectorRuns.error,
        })
        .from(collectorRuns)
        .where(eq(collectorRuns.channel_id, id))
        .orderBy(desc(collectorRuns.started_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(collectorRuns)
        .where(eq(collectorRuns.channel_id, id)),
    ]);

    return NextResponse.json({
      data: rows,
      total: countResult[0]?.count || 0,
      page,
      limit,
    });
  }
);
