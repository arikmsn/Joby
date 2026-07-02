import { NextResponse } from "next/server";
import { eq, and, ne, desc, sql, gte, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceJobs, sourceChannels, demandClusters } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { GrowthPermission, SourceChannelStatus } from "@/lib/constants";

// GET /api/admin/growth/metrics — Stage-1 collection-health panel.
// AGGREGATES ONLY by construction: counts, rates, and durations — this
// endpoint never joins candidate or PII-bearing data.
export const GET = withGrowthAuth(
  GrowthPermission.METRICS_READ,
  async () => {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoDays = new Date(now - 48 * 60 * 60 * 1000);

    const [
      obsToday,
      obs7d,
      queue,
      medianReview,
      channels,
      channelYield,
      clusterStats,
      topClusters,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sourceJobs)
        .where(gte(sourceJobs.created_at, dayAgo)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sourceJobs)
        .where(gte(sourceJobs.created_at, week)),
      db
        .select({
          needs_review: sql<number>`count(*) filter (where ${sourceJobs.needs_review})::int`,
          unclassified: sql<number>`count(*) filter (where ${sourceJobs.role_family} = 'other')::int`,
        })
        .from(sourceJobs),
      // Refinement #1: median review time per observation (7d, resolved rows)
      db
        .select({
          median_seconds: sql<number | null>`
            percentile_cont(0.5) within group (
              order by extract(epoch from ${sourceJobs.review_resolved_at} - ${sourceJobs.created_at})
            )`,
          resolved_count: sql<number>`count(*)::int`,
        })
        .from(sourceJobs)
        .where(
          and(
            isNotNull(sourceJobs.review_resolved_at),
            gte(sourceJobs.review_resolved_at, week)
          )
        ),
      db
        .select({
          id: sourceChannels.id,
          name: sourceChannels.name,
          type: sourceChannels.type,
          collection_method: sourceChannels.collection_method,
          last_collected_at: sourceChannels.last_collected_at,
          last_collect_error: sourceChannels.last_collect_error,
        })
        .from(sourceChannels)
        .where(eq(sourceChannels.status, SourceChannelStatus.APPROVED)),
      db
        .select({
          channel_id: sourceJobs.channel_id,
          count_7d: sql<number>`count(*)::int`,
          last_observed_at: sql<string>`max(${sourceJobs.created_at})`,
        })
        .from(sourceJobs)
        .where(gte(sourceJobs.created_at, week))
        .groupBy(sourceJobs.channel_id),
      db
        .select({
          total: sql<number>`count(*)::int`,
          ad_worthy: sql<number>`count(*) filter (where ${demandClusters.ad_worthy})::int`,
        })
        .from(demandClusters),
      db
        .select({
          role_family: demandClusters.role_family,
          region_code: demandClusters.region_code,
          salary_band: demandClusters.salary_band,
          observation_count: demandClusters.observation_count,
          distinct_employer_count: demandClusters.distinct_employer_count,
          trend: demandClusters.trend,
          ad_worthy: demandClusters.ad_worthy,
        })
        .from(demandClusters)
        .where(ne(demandClusters.observation_count, 0))
        .orderBy(desc(demandClusters.observation_count))
        .limit(10),
    ]);

    // Freshness: automated channels by last_collected_at; manual channels by
    // last observation. ≤48h counts as fresh.
    const yieldByChannel = new Map(
      channelYield.map((y) => [y.channel_id, y])
    );
    const channelHealth = channels.map((c) => {
      const y = yieldByChannel.get(c.id);
      const lastSignal =
        c.collection_method === "manual"
          ? y?.last_observed_at
            ? new Date(y.last_observed_at)
            : null
          : c.last_collected_at;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        collection_method: c.collection_method,
        yield_7d: y?.count_7d ?? 0,
        last_signal_at: lastSignal,
        fresh: !!lastSignal && lastSignal >= twoDays,
        error: c.last_collect_error,
      };
    });
    const freshCount = channelHealth.filter((c) => c.fresh).length;

    return NextResponse.json({
      data: {
        observations: {
          today: obsToday[0]?.count ?? 0,
          last_7d: obs7d[0]?.count ?? 0,
        },
        queue: {
          needs_review: queue[0]?.needs_review ?? 0,
          unclassified: queue[0]?.unclassified ?? 0,
        },
        review_time: {
          median_seconds:
            medianReview[0]?.median_seconds != null
              ? Math.round(Number(medianReview[0].median_seconds))
              : null,
          resolved_7d: medianReview[0]?.resolved_count ?? 0,
        },
        freshness: {
          fresh_channels: freshCount,
          approved_channels: channelHealth.length,
          percent:
            channelHealth.length > 0
              ? Math.round((freshCount / channelHealth.length) * 100)
              : null,
        },
        channels: channelHealth,
        clusters: {
          total: clusterStats[0]?.total ?? 0,
          ad_worthy: clusterStats[0]?.ad_worthy ?? 0,
          top: topClusters,
        },
      },
    });
  }
);
