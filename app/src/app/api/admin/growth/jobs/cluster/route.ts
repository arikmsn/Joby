import { NextResponse } from "next/server";
import { eq, and, ne, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceJobs, demandClusters } from "@/lib/schema";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isGrowthModuleEnabled } from "@/lib/growth/auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { aggregateClusters, computeTrend } from "@/lib/growth/clustering";
import { GrowthAuditAction } from "@/lib/constants";

export const maxDuration = 300;

// POST /api/admin/growth/jobs/cluster — nightly rule-based clustering (cron).
// Recompute-from-scratch, idempotent: aggregates ONLY structured observations
// (human-reviewed: needs_review=false AND role_family≠'other') into
// demand_clusters, upserts by (family, region, band), assigns cluster_id to
// member rows. ad_worthy is computed here only — no API write path exists.
export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isGrowthModuleEnabled()) {
    return NextResponse.json({ error: "MODULE_DISABLED" }, { status: 503 });
  }

  // Structured observations only — raw queue rows never influence clusters
  const rows = await db
    .select({
      id: sourceJobs.id,
      role_family: sourceJobs.role_family,
      region_code: sourceJobs.region_code,
      salary_min: sourceJobs.salary_min,
      salary_max: sourceJobs.salary_max,
      salary_unit: sourceJobs.salary_unit,
      employer_name_public: sourceJobs.employer_name_public,
      observed_at: sourceJobs.observed_at,
    })
    .from(sourceJobs)
    .where(
      and(eq(sourceJobs.needs_review, false), ne(sourceJobs.role_family, "other"))
    );

  const aggregates = aggregateClusters(rows);

  let created = 0;
  let updated = 0;
  let adWorthy = 0;

  for (const agg of aggregates) {
    const trend = computeTrend(agg.last7, agg.prior7);
    if (agg.ad_worthy) adWorthy++;

    const existing = await db
      .select({ id: demandClusters.id })
      .from(demandClusters)
      .where(
        and(
          eq(demandClusters.role_family, agg.role_family),
          eq(demandClusters.region_code, agg.region_code),
          eq(demandClusters.salary_band, agg.salary_band)
        )
      )
      .limit(1);

    let clusterId: string;
    if (existing[0]) {
      clusterId = existing[0].id;
      await db
        .update(demandClusters)
        .set({
          observation_count: agg.observation_count,
          distinct_employer_count: agg.distinct_employer_count,
          first_seen: agg.first_seen,
          last_seen: agg.last_seen,
          trend,
          ad_worthy: agg.ad_worthy,
          updated_at: new Date(),
        })
        .where(eq(demandClusters.id, clusterId));
      updated++;
    } else {
      const [row] = await db
        .insert(demandClusters)
        .values({
          role_family: agg.role_family,
          region_code: agg.region_code,
          salary_band: agg.salary_band,
          observation_count: agg.observation_count,
          distinct_employer_count: agg.distinct_employer_count,
          first_seen: agg.first_seen,
          last_seen: agg.last_seen,
          trend,
          ad_worthy: agg.ad_worthy,
        })
        .returning({ id: demandClusters.id });
      clusterId = row.id;
      created++;
    }

    await db
      .update(sourceJobs)
      .set({ cluster_id: clusterId })
      .where(inArray(sourceJobs.id, agg.observation_ids));
  }

  await logGrowthAudit({
    actor_id: null,
    action: GrowthAuditAction.CLUSTER_RUN,
    entity_type: "demand_clusters",
    reason: `observations=${rows.length} clusters=${aggregates.length} created=${created} updated=${updated} ad_worthy=${adWorthy}`,
  });

  return NextResponse.json({
    ok: true,
    observations: rows.length,
    clusters: aggregates.length,
    created,
    updated,
    ad_worthy: adWorthy,
  });
}
