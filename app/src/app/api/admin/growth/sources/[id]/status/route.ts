import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceChannels } from "@/lib/schema";
import { withGrowthAuth, isSuperAdmin } from "@/lib/growth/auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { sourceChannelStatusSchema } from "@/lib/growth/validators";
import {
  GrowthPermission,
  GrowthAuditAction,
  RiskTier,
  SourceChannelStatus,
} from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// POST /api/admin/growth/sources/[id]/status — approve/pause a channel.
// Collection gate: collectors only operate on approved channels.
// High-risk channels require super_admin (server-enforced by risk_tier).
export const POST = withGrowthAuth(
  GrowthPermission.SOURCES_APPROVE,
  async (req: NextRequest, actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = sourceChannelStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { status, note } = parsed.data;

    const rows = await db
      .select({
        id: sourceChannels.id,
        risk_tier: sourceChannels.risk_tier,
        status: sourceChannels.status,
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

    // Elevated action: activating a high-risk source is super_admin-only
    if (
      status === SourceChannelStatus.APPROVED &&
      channel.risk_tier === RiskTier.HIGH &&
      !isSuperAdmin(actor)
    ) {
      await logGrowthAudit({
        actor_id: actor.id,
        action: GrowthAuditAction.AUTHZ_DENIED,
        entity_type: "source_channel",
        entity_id: id,
        reason: "high-risk approval requires super_admin",
      });
      return NextResponse.json(
        { error: "FORBIDDEN", message: t("error.forbidden") },
        { status: 403 }
      );
    }

    const [updated] = await db
      .update(sourceChannels)
      .set({
        status,
        approved_by: status === SourceChannelStatus.APPROVED ? actor.id : undefined,
        approved_at:
          status === SourceChannelStatus.APPROVED ? new Date() : undefined,
        updated_at: new Date(),
      })
      .where(eq(sourceChannels.id, id))
      .returning({
        id: sourceChannels.id,
        status: sourceChannels.status,
        approved_at: sourceChannels.approved_at,
      });

    await logGrowthAudit({
      actor_id: actor.id,
      action: GrowthAuditAction.SOURCE_STATUS_CHANGED,
      entity_type: "source_channel",
      entity_id: id,
      reason: `${channel.status} -> ${status}${note ? ` | ${note}` : ""}`,
    });

    return NextResponse.json({ data: updated });
  }
);
