import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { withGrowthAuth, isSuperAdmin } from "@/lib/growth/auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { growthRoleRevokeSchema } from "@/lib/growth/validators";
import { GrowthPermission, GrowthAuditAction } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

// POST /api/admin/growth/roles/revoke — super_admin only, audited.
export const POST = withGrowthAuth(
  GrowthPermission.ROLES_MANAGE,
  async (req: NextRequest, actor) => {
    if (!isSuperAdmin(actor)) {
      // Bootstrap state lets non-super admins reach ROLES_MANAGE, but
      // revoke is never a bootstrap action.
      return NextResponse.json(
        { error: "FORBIDDEN", message: t("error.forbidden") },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = growthRoleRevokeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { user_id } = parsed.data;

    const target = await db
      .select({ id: users.id, sub_role: users.admin_sub_role })
      .from(users)
      .where(eq(users.id, user_id))
      .limit(1);
    if (!target[0]) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    await db
      .update(users)
      .set({ admin_sub_role: null, updated_at: new Date() })
      .where(eq(users.id, user_id));

    await logGrowthAudit({
      actor_id: actor.id,
      action: GrowthAuditAction.ROLE_REVOKED,
      entity_type: "user",
      entity_id: user_id,
      reason: `${target[0].sub_role ?? "none"} -> none`,
    });

    return NextResponse.json({ ok: true, user_id });
  }
);
