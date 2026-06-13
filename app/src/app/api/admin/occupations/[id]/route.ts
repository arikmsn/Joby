import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { occupationCatalog } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminUpdateOccupationSchema } from "@/lib/validators";
import { UserRole } from "@/lib/constants";
import { eq } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// PATCH /api/admin/occupations/:id — edit label_he/sort_order/is_active only (admin only). Key is immutable.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminUpdateOccupationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db.select().from(occupationCatalog).where(eq(occupationCatalog.id, params.id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (data.label_he !== undefined) updates.label_he = data.label_he;
  if (data.sort_order !== undefined) updates.sort_order = data.sort_order;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ occupation: existing[0] });
  }

  const updated = await db
    .update(occupationCatalog)
    .set(updates)
    .where(eq(occupationCatalog.id, params.id))
    .returning();

  return NextResponse.json({ occupation: updated[0] });
}
