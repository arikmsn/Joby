import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/schema";
import { withGrowthAuth, isSuperAdmin } from "@/lib/growth/auth";
import { auditFilterSchema } from "@/lib/growth/validators";
import { GrowthPermission } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

// GET /api/admin/growth/audit — append-only log, read-only endpoint.
// super_admin sees all entries; growth_ops sees own actions only.
// Entries contain ids only — never PII values. Paginated, no export.
export const GET = withGrowthAuth(
  GrowthPermission.AUDIT_READ,
  async (req: NextRequest, actor) => {
    const url = new URL(req.url);
    const parsed = auditFilterSchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { action, entity_type, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (!isSuperAdmin(actor)) {
      // own-actions scope for non-super holders of AUDIT_READ (growth_ops)
      conditions.push(eq(auditLogs.actor_id, actor.id));
    }
    if (action) conditions.push(eq(auditLogs.action, action));
    if (entity_type) conditions.push(eq(auditLogs.entity_type, entity_type));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          actor_id: auditLogs.actor_id,
          action: auditLogs.action,
          entity_type: auditLogs.entity_type,
          entity_id: auditLogs.entity_id,
          reason: auditLogs.reason,
          created_at: auditLogs.created_at,
        })
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
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
