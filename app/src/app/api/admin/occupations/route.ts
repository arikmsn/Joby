import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { occupationCatalog } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminCreateOccupationSchema } from "@/lib/validators";
import { UserRole } from "@/lib/constants";
import { asc, sql, eq } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

// GET /api/admin/occupations — list all occupations incl. inactive (admin only)
export async function GET(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  const rows = await db.select().from(occupationCatalog).orderBy(asc(occupationCatalog.sort_order));
  return NextResponse.json({ occupations: rows });
}

// POST /api/admin/occupations — add new occupation (admin only). Key is immutable once created.
export async function POST(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminCreateOccupationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db.select().from(occupationCatalog).where(eq(occupationCatalog.key, data.key)).limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "OCCUPATION_EXISTS", message: t("error.validation") }, { status: 409 });
  }

  let sortOrder = data.sort_order;
  if (sortOrder === undefined) {
    const maxResult = await db.select({ max: sql<number>`coalesce(max(${occupationCatalog.sort_order}), 0)::int` }).from(occupationCatalog);
    sortOrder = (maxResult[0]?.max || 0) + 1;
  }

  const rows = await db
    .insert(occupationCatalog)
    .values({ key: data.key, label_he: data.label_he, sort_order: sortOrder })
    .returning();

  return NextResponse.json({ occupation: rows[0] }, { status: 201 });
}
