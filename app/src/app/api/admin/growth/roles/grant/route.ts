import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import {
  withGrowthAuth,
  isSuperAdmin,
  isBootstrapState,
} from "@/lib/growth/auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { growthRoleSchema } from "@/lib/growth/validators";
import {
  UserRole,
  GrowthPermission,
  GrowthSubRole,
  GrowthAuditAction,
} from "@/lib/constants";
import { t } from "@/lib/i18n/he";

// POST /api/admin/growth/roles/grant — super_admin only.
// Bootstrap: while no super_admin exists, an admin may self-grant
// super_admin (and nothing else). Every grant is audit-logged.
export const POST = withGrowthAuth(
  GrowthPermission.ROLES_MANAGE,
  async (req: NextRequest, actor) => {
    const body = await req.json().catch(() => null);
    const parsed = growthRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { user_id, sub_role } = parsed.data;

    if (!isSuperAdmin(actor)) {
      // Only reachable in bootstrap state (wrapper). Re-check and constrain.
      const bootstrap = await isBootstrapState();
      const isSelfSuperGrant =
        bootstrap &&
        user_id === actor.id &&
        sub_role === GrowthSubRole.SUPER_ADMIN;
      if (!isSelfSuperGrant) {
        return NextResponse.json(
          { error: "FORBIDDEN", message: t("error.forbidden") },
          { status: 403 }
        );
      }
    }

    const target = await db
      .select({ id: users.id, role: users.role, sub_role: users.admin_sub_role })
      .from(users)
      .where(eq(users.id, user_id))
      .limit(1);
    if (!target[0] || target[0].role !== UserRole.ADMIN) {
      // Only role=admin users are eligible for growth sub-roles
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    await db
      .update(users)
      .set({ admin_sub_role: sub_role, updated_at: new Date() })
      .where(eq(users.id, user_id));

    await logGrowthAudit({
      actor_id: actor.id,
      action: GrowthAuditAction.ROLE_GRANTED,
      entity_type: "user",
      entity_id: user_id,
      reason: `${target[0].sub_role ?? "none"} -> ${sub_role}`,
    });

    return NextResponse.json({ ok: true, user_id, sub_role });
  }
);
