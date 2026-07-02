import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceChannels } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { updateSourceChannelSchema } from "@/lib/growth/validators";
import { parseSourceConfig, sourceConfigSchema } from "@/lib/growth/source-config";
import { GrowthPermission, GrowthAuditAction } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// GET /api/admin/growth/sources/[id] — full channel detail incl. parsed config
export const GET = withGrowthAuth(
  GrowthPermission.SOURCES_READ,
  async (_req: NextRequest, _actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }
    const rows = await db
      .select()
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
    // Always return a validated config (defaults when null)
    return NextResponse.json({
      data: { ...channel, config: parseSourceConfig(channel.config) },
    });
  }
);

// PATCH /api/admin/growth/sources/[id] — edit fields + crawl config.
// Config is validated against sourceConfigSchema before storage; changes
// are audited. Requires sources.write (analyst can edit; approval stays a
// separate permission).
export const PATCH = withGrowthAuth(
  GrowthPermission.SOURCES_WRITE,
  async (req: NextRequest, actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }
    const body = await req.json().catch(() => null);
    const parsed = updateSourceChannelSchema.safeParse(body);
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

    const updates: Record<string, unknown> = { updated_at: new Date() };
    const { name, url, robots_tos_notes, crawl_enabled, config } = parsed.data;
    if (name !== undefined) updates.name = name;
    if (url !== undefined) updates.url = url;
    if (robots_tos_notes !== undefined) updates.robots_tos_notes = robots_tos_notes;
    if (crawl_enabled !== undefined) updates.crawl_enabled = crawl_enabled;

    if (config !== undefined) {
      const cfg = sourceConfigSchema.safeParse(config);
      if (!cfg.success) {
        return NextResponse.json(
          {
            error: "VALIDATION",
            message: t("error.validation"),
            fields: cfg.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
      updates.config = cfg.data;
    }

    const [updated] = await db
      .update(sourceChannels)
      .set(updates)
      .where(eq(sourceChannels.id, id))
      .returning({ id: sourceChannels.id, crawl_enabled: sourceChannels.crawl_enabled });

    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    await logGrowthAudit({
      actor_id: actor.id,
      action: GrowthAuditAction.SOURCE_STATUS_CHANGED,
      entity_type: "source_channel",
      entity_id: id,
      reason: `config updated (${Object.keys(updates).filter((k) => k !== "updated_at").join(", ")})`,
    });

    return NextResponse.json({ data: updated });
  }
);
