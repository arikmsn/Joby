// ============================================================
// Growth Engine — server-side authorization boundary.
// EVERY /api/admin/growth/* handler MUST be wrapped with
// withGrowthAuth. Deny-by-default: no sub-role → 403,
// unknown permission → 403, module flag off → 503.
// The client-side admin layout guard is UX only — this wrapper
// is the actual control.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import {
  UserRole,
  GrowthSubRole,
  GrowthPermission,
  GROWTH_ROLE_PERMISSIONS,
  GrowthAuditAction,
} from "@/lib/constants";
import type { AuthUser } from "@/lib/types";
import { logGrowthAudit } from "./audit";
import { t } from "@/lib/i18n/he";

export function isGrowthModuleEnabled(): boolean {
  return process.env.GROWTH_MODULE_ENABLED === "true";
}

const ALL_PERMISSIONS = new Set<string>(Object.values(GrowthPermission));

export function hasGrowthPermission(
  subRole: string | null | undefined,
  permission: GrowthPermission
): boolean {
  // Deny-by-default: unknown permission strings are never granted
  if (!ALL_PERMISSIONS.has(permission)) return false;
  if (!subRole) return false;
  if (subRole === GrowthSubRole.SUPER_ADMIN) return true;
  const granted =
    GROWTH_ROLE_PERMISSIONS[
      subRole as Exclude<GrowthSubRole, "super_admin">
    ];
  if (!granted) return false;
  return granted.includes(permission);
}

type RouteContext = { params: Record<string, string> };

export type GrowthHandler = (
  req: NextRequest,
  user: AuthUser,
  ctx: RouteContext
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap a growth API handler with the module's authorization chain:
 * flag check → admin JWT (requireRole) → sub-role permission check.
 * 403s on growth endpoints are audit-logged (AUTHZ_DENIED).
 */
export function withGrowthAuth(
  permission: GrowthPermission,
  handler: GrowthHandler
): (req: NextRequest, ctx: RouteContext) => Promise<NextResponse> {
  return async (req: NextRequest, ctx: RouteContext) => {
    if (!isGrowthModuleEnabled()) {
      return NextResponse.json(
        { error: "MODULE_DISABLED", message: t("error.generic") },
        { status: 503 }
      );
    }

    const result = await requireRole(req, UserRole.ADMIN);
    if (result instanceof NextResponse) {
      // 401 (no/bad token) or 403 (non-admin role). Audit denied admin-area probes.
      if (result.status === 403) {
        await logGrowthAudit({
          actor_id: null,
          action: GrowthAuditAction.AUTHZ_DENIED,
          entity_type: "route",
          entity_id: new URL(req.url).pathname,
          reason: "non-admin role",
        });
      }
      return result;
    }

    let allowed = hasGrowthPermission(result.admin_sub_role, permission);

    // Bootstrap exception: until any super_admin exists, an admin may reach
    // the roles endpoint — the handler itself enforces that the only action
    // possible in this state is a self-grant of super_admin (audited).
    if (
      !allowed &&
      permission === GrowthPermission.ROLES_MANAGE &&
      (await isBootstrapState())
    ) {
      allowed = true;
    }

    if (!allowed) {
      await logGrowthAudit({
        actor_id: result.id,
        action: GrowthAuditAction.AUTHZ_DENIED,
        entity_type: "route",
        entity_id: new URL(req.url).pathname,
        reason: `missing ${permission}`,
      });
      return NextResponse.json(
        { error: "FORBIDDEN", message: t("error.forbidden") },
        { status: 403 }
      );
    }

    return handler(req, result, ctx);
  };
}

/** True only for the super_admin sub-role (elevated/dual-review actions). */
export function isSuperAdmin(user: AuthUser): boolean {
  return user.admin_sub_role === GrowthSubRole.SUPER_ADMIN;
}

/** Bootstrap state = no super_admin exists yet anywhere. */
export async function isBootstrapState(): Promise<boolean> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.admin_sub_role, GrowthSubRole.SUPER_ADMIN));
  return (rows[0]?.count ?? 0) === 0;
}
