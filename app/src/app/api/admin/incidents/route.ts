import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { incidents, users, shifts } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminIncidentFilterSchema } from "@/lib/validators";
import { UserRole } from "@/lib/constants";
import { eq, and, sql, desc } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// GET /api/admin/incidents — list/filter incidents (admin only)
export async function GET(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  const url = new URL(req.url);
  const parsed = adminIncidentFilterSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }
  const { status, incident_type, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(incidents.status, status));
  if (incident_type) conditions.push(eq(incidents.incident_type, incident_type));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: incidents.id,
        incident_type: incidents.incident_type,
        severity: incidents.severity,
        status: incidents.status,
        title: incidents.title,
        description: incidents.description,
        related_user_id: incidents.related_user_id,
        related_shift_id: incidents.related_shift_id,
        resolution_notes: incidents.resolution_notes,
        created_at: incidents.created_at,
        resolved_at: incidents.resolved_at,
        related_user_name: users.full_name,
        related_shift_title: shifts.title,
      })
      .from(incidents)
      .leftJoin(users, eq(incidents.related_user_id, users.id))
      .leftJoin(shifts, eq(incidents.related_shift_id, shifts.id))
      .where(where)
      .orderBy(desc(incidents.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(incidents).where(where),
  ]);

  return NextResponse.json({
    data: rows,
    total: countResult[0]?.count || 0,
    page,
    limit,
  });
}
