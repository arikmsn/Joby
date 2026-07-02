import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceJobs, sourceChannels } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import {
  createObservationSchema,
  observationFilterSchema,
} from "@/lib/growth/validators";
import { computeDedupHash } from "@/lib/growth/dedup";
import { GrowthPermission, RAW_TEXT_TTL_DAYS, SourceChannelStatus } from "@/lib/constants";
import { t } from "@/lib/i18n/he";
import { tGrowth } from "@/lib/i18n/he-growth";

// Never select raw_text past its TTL (query-level guard — the purge job is
// the cleanup, this is the read-side enforcement).
const rawTextWithinTtl = sql<string | null>`
  case when ${sourceJobs.raw_text_expires_at} > now()
       then ${sourceJobs.raw_text} else null end
`;

// GET /api/admin/growth/observations — list + review queue (needs_review=true)
export const GET = withGrowthAuth(
  GrowthPermission.OBSERVATIONS_READ,
  async (req: NextRequest) => {
    const url = new URL(req.url);
    const parsed = observationFilterSchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { channel_id, role_family, region_code, needs_review, page, limit } =
      parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (channel_id) conditions.push(eq(sourceJobs.channel_id, channel_id));
    if (role_family) conditions.push(eq(sourceJobs.role_family, role_family));
    if (region_code) conditions.push(eq(sourceJobs.region_code, region_code));
    if (needs_review !== undefined)
      conditions.push(eq(sourceJobs.needs_review, needs_review));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: sourceJobs.id,
          channel_id: sourceJobs.channel_id,
          channel_name: sourceChannels.name,
          observed_at: sourceJobs.observed_at,
          role_family: sourceJobs.role_family,
          role_title_norm: sourceJobs.role_title_norm,
          region_code: sourceJobs.region_code,
          city: sourceJobs.city,
          employer_name_public: sourceJobs.employer_name_public,
          employer_type: sourceJobs.employer_type,
          salary_min: sourceJobs.salary_min,
          salary_max: sourceJobs.salary_max,
          salary_unit: sourceJobs.salary_unit,
          shift_tags: sourceJobs.shift_tags,
          requirement_flags: sourceJobs.requirement_flags,
          urgency_score: sourceJobs.urgency_score,
          source_ref: sourceJobs.source_ref,
          raw_text: rawTextWithinTtl,
          extraction_confidence: sourceJobs.extraction_confidence,
          needs_review: sourceJobs.needs_review,
          created_at: sourceJobs.created_at,
        })
        .from(sourceJobs)
        .leftJoin(sourceChannels, eq(sourceJobs.channel_id, sourceChannels.id))
        .where(where)
        .orderBy(desc(sourceJobs.observed_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sourceJobs)
        .where(where),
    ]);

    return NextResponse.json({
      data: rows,
      total: countResult[0]?.count || 0,
      page,
      limit,
    });
  }
);

// POST /api/admin/growth/observations — analyst manual sweep entry.
// Facts only; optional raw_text gets a hard 30-day TTL; dedup_hash is
// computed server-side and enforced by a unique index.
export const POST = withGrowthAuth(
  GrowthPermission.OBSERVATIONS_WRITE,
  async (req: NextRequest, actor) => {
    const body = await req.json().catch(() => null);
    const parsed = createObservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION",
          message: t("error.validation"),
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Observations may only be recorded against approved channels
    const channelRows = await db
      .select({ id: sourceChannels.id, status: sourceChannels.status })
      .from(sourceChannels)
      .where(eq(sourceChannels.id, data.channel_id))
      .limit(1);
    if (!channelRows[0] || channelRows[0].status !== SourceChannelStatus.APPROVED) {
      return NextResponse.json(
        { error: "CHANNEL_NOT_APPROVED", message: t("error.validation") },
        { status: 400 }
      );
    }

    const observedAt = new Date(data.observed_at);
    const dedupHash = computeDedupHash({
      employer_name_public: data.employer_name_public,
      role_title_norm: data.role_title_norm,
      city: data.city,
      region_code: data.region_code,
      observed_at: observedAt,
    });

    try {
      const [created] = await db
        .insert(sourceJobs)
        .values({
          channel_id: data.channel_id,
          observed_at: observedAt,
          role_family: data.role_family,
          role_title_norm: data.role_title_norm,
          region_code: data.region_code,
          city: data.city ?? null,
          employer_name_public: data.employer_name_public ?? null,
          employer_type: data.employer_type,
          salary_min: data.salary_min != null ? String(data.salary_min) : null,
          salary_max: data.salary_max != null ? String(data.salary_max) : null,
          salary_unit: data.salary_unit ?? null,
          shift_tags: data.shift_tags,
          requirement_flags: data.requirement_flags,
          urgency_score: data.urgency_score,
          source_ref: data.source_ref ?? null,
          raw_text: data.raw_text ?? null,
          raw_text_expires_at: data.raw_text
            ? new Date(Date.now() + RAW_TEXT_TTL_DAYS * 24 * 60 * 60 * 1000)
            : null,
          dedup_hash: dedupHash,
          created_by: actor.id,
        })
        .returning({ id: sourceJobs.id, created_at: sourceJobs.created_at });

      return NextResponse.json({ data: created }, { status: 201 });
    } catch (err: unknown) {
      // Unique violation on dedup_hash = duplicate within the 14-day window
      const message = err instanceof Error ? err.message : "";
      if (message.includes("source_jobs_dedup_idx") || message.includes("duplicate key")) {
        return NextResponse.json(
          { error: "DUPLICATE", message: tGrowth("growth.obs.duplicate") },
          { status: 409 }
        );
      }
      throw err;
    }
  }
);
