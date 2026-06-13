import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { incidents } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminUpdateIncidentSchema } from "@/lib/validators";
import { UserRole, IncidentStatus } from "@/lib/constants";
import { eq } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// PATCH /api/admin/incidents/:id — resolve/dismiss an incident (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminUpdateIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db.select().from(incidents).where(eq(incidents.id, params.id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    status: data.status,
    updated_at: new Date(),
  };
  if (data.resolution_notes !== undefined) updates.resolution_notes = data.resolution_notes;
  if (data.status === IncidentStatus.RESOLVED || data.status === IncidentStatus.DISMISSED) {
    updates.resolved_at = new Date();
  }

  const updated = await db.update(incidents).set(updates).where(eq(incidents.id, params.id)).returning();

  return NextResponse.json({ incident: updated[0] });
}
