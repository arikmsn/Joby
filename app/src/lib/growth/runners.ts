// ============================================================
// Growth Engine — job runners (Stage 1f).
// Shared by cron routes and admin "run now" / system-jobs so the
// scheduling, retry, and run-history logic lives in one place.
// Collection gate unchanged: only APPROVED channels are visited.
// ============================================================

import {
  eq,
  and,
  ne,
  inArray,
  isNotNull,
  or,
  lt,
  lte,
  isNull,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceChannels, collectorRuns, sourceJobs, demandClusters } from "@/lib/schema";
import { collectChannel } from "./collect";
import { parseSourceConfig, isWithinWindow } from "./source-config";
import { aggregateClusters, computeTrend } from "./clustering";
import { logGrowthAudit } from "./audit";
import {
  SourceChannelStatus,
  SourceChannelType,
  CollectionMethod,
  GrowthAuditAction,
} from "@/lib/constants";

const MAX_CHANNELS_PER_COLLECT_RUN = 20;

const COLLECTABLE_TYPES = [
  SourceChannelType.TELEGRAM,
  SourceChannelType.GOV,
  SourceChannelType.CAREER_PAGE,
  SourceChannelType.AGENCY,
  SourceChannelType.OTHER,
];

interface ChannelRow {
  id: string;
  type: string;
  name: string;
  url: string | null;
  crawl_enabled: boolean;
  config: unknown;
  consecutive_failures: number;
}

/** Compute next_run_at from a channel's schedule config. */
function computeNextRun(config: unknown): Date {
  const { schedule } = parseSourceConfig(config);
  return new Date(Date.now() + schedule.frequency_hours * 60 * 60 * 1000);
}

/**
 * Collect a single channel end-to-end: writes a collector_runs row,
 * runs the collector, updates freshness + failure/backoff bookkeeping.
 */
export async function runChannelCollection(
  channel: ChannelRow,
  trigger: "cron" | "manual",
  triggeredBy: string | null
): Promise<{ runId: string; ingested: number; error?: string }> {
  const [run] = await db
    .insert(collectorRuns)
    .values({
      channel_id: channel.id,
      job: "collect_channel",
      trigger,
      status: "running",
      triggered_by: triggeredBy,
    })
    .returning({ id: collectorRuns.id });

  const result = await collectChannel({
    id: channel.id,
    type: channel.type,
    name: channel.name,
    url: channel.url,
    crawl_enabled: channel.crawl_enabled,
    config: channel.config,
  });

  const { schedule } = parseSourceConfig(channel.config);
  const failed = !!result.error;
  const nextFailures = failed ? channel.consecutive_failures + 1 : 0;
  // auto-disable crawling after max_retries consecutive failures (audited)
  const autoDisable = failed && nextFailures >= schedule.max_retries + 1;

  await db
    .update(collectorRuns)
    .set({
      status: failed ? "error" : "success",
      finished_at: new Date(),
      pages_crawled: result.pages_crawled ?? result.fetched,
      urls_discovered: result.urls_discovered ?? 0,
      items_ingested: result.ingested,
      duplicates: result.duplicates,
      filtered_out: result.filtered,
      error: result.error ?? null,
      stats: result,
    })
    .where(eq(collectorRuns.id, run.id));

  await db
    .update(sourceChannels)
    .set({
      last_collected_at: new Date(),
      last_collect_error: result.error ?? null,
      consecutive_failures: nextFailures,
      next_run_at: computeNextRun(channel.config),
      ...(autoDisable ? { crawl_enabled: false } : {}),
      updated_at: new Date(),
    })
    .where(eq(sourceChannels.id, channel.id));

  if (autoDisable) {
    await logGrowthAudit({
      actor_id: triggeredBy,
      action: GrowthAuditAction.SOURCE_STATUS_CHANGED,
      entity_type: "source_channel",
      entity_id: channel.id,
      reason: `crawl auto-disabled after ${nextFailures} consecutive failures`,
    });
  }

  return { runId: run.id, ingested: result.ingested, error: result.error };
}

/**
 * Scheduled collect run: pick due, approved, collectable channels that are
 * inside their preferred hours window, stalest-first.
 */
export async function runCollectJob(
  trigger: "cron" | "manual",
  triggeredBy: string | null
): Promise<{ channels: number; ingested: number; duplicates: number; errors: number; results: unknown[] }> {
  const now = new Date();
  const channels = await db
    .select({
      id: sourceChannels.id,
      type: sourceChannels.type,
      name: sourceChannels.name,
      url: sourceChannels.url,
      crawl_enabled: sourceChannels.crawl_enabled,
      config: sourceChannels.config,
      consecutive_failures: sourceChannels.consecutive_failures,
    })
    .from(sourceChannels)
    .where(
      and(
        eq(sourceChannels.status, SourceChannelStatus.APPROVED),
        inArray(sourceChannels.type, COLLECTABLE_TYPES),
        inArray(sourceChannels.collection_method, [
          CollectionMethod.FETCH,
          CollectionMethod.API,
        ]),
        isNotNull(sourceChannels.url),
        // due: never run, or next_run_at in the past
        or(isNull(sourceChannels.next_run_at), lte(sourceChannels.next_run_at, now))
      )
    )
    .orderBy(sql`${sourceChannels.last_collected_at} asc nulls first`)
    .limit(MAX_CHANNELS_PER_COLLECT_RUN);

  const due = channels.filter((c) => {
    const { schedule } = parseSourceConfig(c.config);
    return isWithinWindow(schedule, now);
  });

  const results = [];
  let ingested = 0;
  const duplicates = 0;
  let errors = 0;
  for (const channel of due) {
    const r = await runChannelCollection(channel, trigger, triggeredBy);
    results.push({ channel_id: channel.id, ...r });
    ingested += r.ingested;
    if (r.error) errors++;
  }

  await logGrowthAudit({
    actor_id: triggeredBy,
    action: GrowthAuditAction.COLLECT_RUN,
    entity_type: "source_channels",
    reason: `trigger=${trigger} due=${due.length}/${channels.length} ingested=${ingested} errors=${errors}`,
  });

  return { channels: due.length, ingested, duplicates, errors, results };
}

/**
 * Rule-based clustering: recompute-from-scratch over STRUCTURED observations
 * only (reviewed, classified ≠ 'other'). Upserts demand_clusters by
 * (family, region, band); ad_worthy is job-computed here — no API write path.
 */
export async function runClusterJob(
  triggeredBy: string | null
): Promise<{ observations: number; clusters: number; created: number; updated: number; ad_worthy: number }> {
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
    actor_id: triggeredBy,
    action: GrowthAuditAction.CLUSTER_RUN,
    entity_type: "demand_clusters",
    reason: `observations=${rows.length} clusters=${aggregates.length} created=${created} updated=${updated} ad_worthy=${adWorthy}`,
  });

  return { observations: rows.length, clusters: aggregates.length, created, updated, ad_worthy: adWorthy };
}

/**
 * Raw-text TTL purge: null raw_text past its expiry. Extracted facts remain.
 * Guardrail — source ad text is never retained past RAW_TEXT_TTL_DAYS.
 */
export async function runPurgeJob(
  triggeredBy: string | null
): Promise<{ purged: number }> {
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
    actor_id: triggeredBy,
    action: GrowthAuditAction.PURGE_RUN,
    entity_type: "source_jobs",
    reason: `purged raw_text on ${result.length} row(s)`,
  });

  return { purged: result.length };
}
