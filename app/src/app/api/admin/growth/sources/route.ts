import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceChannels, users } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import {
  createSourceChannelSchema,
  sourceChannelFilterSchema,
} from "@/lib/growth/validators";
import { GrowthPermission } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

// GET /api/admin/growth/sources — channel registry (all growth roles read)
export const GET = withGrowthAuth(
  GrowthPermission.SOURCES_READ,
  async (req: NextRequest) => {
    const url = new URL(req.url);
    const parsed = sourceChannelFilterSchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { status, type, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(sourceChannels.status, status));
    if (type) conditions.push(eq(sourceChannels.type, type));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: sourceChannels.id,
          type: sourceChannels.type,
          name: sourceChannels.name,
          url: sourceChannels.url,
          collection_method: sourceChannels.collection_method,
          risk_tier: sourceChannels.risk_tier,
          status: sourceChannels.status,
          robots_tos_notes: sourceChannels.robots_tos_notes,
          crawl_enabled: sourceChannels.crawl_enabled,
          approved_at: sourceChannels.approved_at,
          created_at: sourceChannels.created_at,
          approved_by_name: users.full_name,
        })
        .from(sourceChannels)
        .leftJoin(users, eq(sourceChannels.approved_by, users.id))
        .where(where)
        .orderBy(desc(sourceChannels.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sourceChannels)
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

// POST /api/admin/growth/sources — propose a channel (status always 'proposed';
// activation is a separate, gated action)
export const POST = withGrowthAuth(
  GrowthPermission.SOURCES_WRITE,
  async (req: NextRequest, actor) => {
    const body = await req.json().catch(() => null);
    const parsed = createSourceChannelSchema.safeParse(body);
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

    const [created] = await db
      .insert(sourceChannels)
      .values({
        ...parsed.data,
        status: "proposed",
        created_by: actor.id,
      })
      .returning({
        id: sourceChannels.id,
        type: sourceChannels.type,
        name: sourceChannels.name,
        url: sourceChannels.url,
        collection_method: sourceChannels.collection_method,
        risk_tier: sourceChannels.risk_tier,
        status: sourceChannels.status,
        created_at: sourceChannels.created_at,
      });

    return NextResponse.json({ data: created }, { status: 201 });
  }
);
