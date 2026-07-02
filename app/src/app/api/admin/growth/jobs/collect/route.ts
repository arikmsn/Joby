import { NextResponse } from "next/server";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceChannels } from "@/lib/schema";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isGrowthModuleEnabled } from "@/lib/growth/auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { collectChannel } from "@/lib/growth/collect";
import {
  GrowthAuditAction,
  SourceChannelStatus,
  SourceChannelType,
  CollectionMethod,
} from "@/lib/constants";

export const maxDuration = 300;

const COLLECTABLE_TYPES = [
  SourceChannelType.TELEGRAM,
  SourceChannelType.GOV,
  SourceChannelType.CAREER_PAGE,
];
const MAX_CHANNELS_PER_RUN = 20;
const DELAY_BETWEEN_CHANNELS_MS = 2000;
const DELAY_SAME_DOMAIN_MS = 10000; // polite-fetch rule: ≤1 req/10s/domain

// POST /api/admin/growth/jobs/collect — Stage-1 collector run (cron).
// Collection gate: ONLY approved channels with an automated collection
// method are visited. Raw items land in the human review queue (no AI).
// Every run is audited with counts only.
export async function POST(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isGrowthModuleEnabled()) {
    return NextResponse.json({ error: "MODULE_DISABLED" }, { status: 503 });
  }

  const channels = await db
    .select({
      id: sourceChannels.id,
      type: sourceChannels.type,
      name: sourceChannels.name,
      url: sourceChannels.url,
      last_collected_at: sourceChannels.last_collected_at,
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
        isNotNull(sourceChannels.url)
      )
    )
    // stalest first so every channel gets visited across runs
    .orderBy(sourceChannels.last_collected_at)
    .limit(MAX_CHANNELS_PER_RUN);

  const results = [];
  let lastDomain = "";
  for (const channel of channels) {
    const domain = channel.url ? new URL(channel.url).hostname : "";
    const delay =
      domain && domain === lastDomain
        ? DELAY_SAME_DOMAIN_MS
        : results.length > 0
          ? DELAY_BETWEEN_CHANNELS_MS
          : 0;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    lastDomain = domain;

    const result = await collectChannel(channel);
    results.push(result);

    await db
      .update(sourceChannels)
      .set({
        last_collected_at: new Date(),
        last_collect_error: result.error ?? null,
        updated_at: new Date(),
      })
      .where(eq(sourceChannels.id, channel.id));
  }

  const totals = results.reduce(
    (acc, r) => ({
      ingested: acc.ingested + r.ingested,
      duplicates: acc.duplicates + r.duplicates,
      errors: acc.errors + (r.error ? 1 : 0),
    }),
    { ingested: 0, duplicates: 0, errors: 0 }
  );

  await logGrowthAudit({
    actor_id: null,
    action: GrowthAuditAction.COLLECT_RUN,
    entity_type: "source_channels",
    reason: `channels=${results.length} ingested=${totals.ingested} duplicates=${totals.duplicates} errors=${totals.errors}`,
  });

  return NextResponse.json({
    ok: true,
    channels: results.length,
    ...totals,
    results,
  });
}
