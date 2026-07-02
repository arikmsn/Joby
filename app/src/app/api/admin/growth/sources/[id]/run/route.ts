import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceChannels } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { runChannelCollection } from "@/lib/growth/runners";
import { GrowthPermission, SourceChannelStatus } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

export const maxDuration = 300;

// POST /api/admin/growth/sources/[id]/run — "Run now" (manual collection).
// Collection gate unchanged: only APPROVED channels can run. Writes a
// collector_runs row and updates freshness/backoff. Requires sources.approve
// (running is an operational action, same tier as activation).
export const POST = withGrowthAuth(
  GrowthPermission.SOURCES_APPROVE,
  async (_req: NextRequest, actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }
    const rows = await db
      .select({
        id: sourceChannels.id,
        type: sourceChannels.type,
        name: sourceChannels.name,
        url: sourceChannels.url,
        status: sourceChannels.status,
        crawl_enabled: sourceChannels.crawl_enabled,
        config: sourceChannels.config,
        consecutive_failures: sourceChannels.consecutive_failures,
      })
      .from(sourceChannels)
      .where(eq(sourceChannels.id, id))
      .limit(1);
    const channel = rows[0];
    if (!channel) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }
    if (channel.status !== SourceChannelStatus.APPROVED) {
      return NextResponse.json(
        { error: "NOT_APPROVED", message: t("error.validation") },
        { status: 400 }
      );
    }

    const result = await runChannelCollection(channel, "manual", actor.id);
    return NextResponse.json({ ok: true, ...result });
  }
);
