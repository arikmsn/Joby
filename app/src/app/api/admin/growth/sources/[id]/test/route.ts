import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceChannels } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { testSourceSchema } from "@/lib/growth/validators";
import { sourceConfigSchema, parseSourceConfig } from "@/lib/growth/source-config";
import { crawlSource } from "@/lib/growth/crawler";
import { GrowthPermission } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

export const maxDuration = 120;

// POST /api/admin/growth/sources/[id]/test — DRY RUN. Crawls with the stored
// (or inline-override) config and returns discovered / allowed / blocked URLs
// and sample extracted text. Persists NOTHING — no observations, no run row,
// no freshness update. Test mode still respects the SSRF guard, exclude rules
// (incl. seeds), and robots.txt. Available to any sources.read holder.
export const POST = withGrowthAuth(
  GrowthPermission.SOURCES_READ,
  async (req: NextRequest, _actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = testSourceSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }

    const rows = await db
      .select({
        id: sourceChannels.id,
        url: sourceChannels.url,
        config: sourceChannels.config,
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

    // inline override lets ops preview rule edits before saving
    let config;
    if (parsed.data.config !== undefined) {
      const cfg = sourceConfigSchema.safeParse(parsed.data.config);
      if (!cfg.success) {
        return NextResponse.json(
          { error: "VALIDATION", message: t("error.validation") },
          { status: 400 }
        );
      }
      config = cfg.data;
    } else {
      config = parseSourceConfig(channel.config);
    }

    const crawl = await crawlSource(
      { id: channel.id, url: channel.url },
      config,
      { dryRun: true }
    );

    // Summarize into the requested discovered/allowed/blocked buckets
    const allowed = crawl.urls.filter((u) => u.verdict === "allowed");
    const blocked = crawl.urls.filter((u) => u.verdict !== "allowed");
    return NextResponse.json({
      data: {
        summary: {
          discovered: crawl.urls_discovered,
          crawled: crawl.pages_crawled,
          allowed: allowed.length,
          blocked: blocked.length,
          ingestable: crawl.ingested,
          filtered_out: crawl.filtered_out,
          stopped_reason: crawl.stopped_reason,
          error: crawl.error,
        },
        allowed_urls: allowed.map((u) => u.url).slice(0, 50),
        blocked_urls: blocked
          .map((u) => ({ url: u.url, verdict: u.verdict, detail: u.detail }))
          .slice(0, 50),
        samples: crawl.pages
          .filter((p) => p.sample)
          .map((p) => ({
            url: p.url,
            outcome: p.outcome,
            filter_reason: p.filter_reason,
            priority: p.priority,
            sample: p.sample,
          }))
          .slice(0, 10),
      },
    });
  }
);
