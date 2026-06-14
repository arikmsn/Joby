import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { employerProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { updateEmployerMeSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const rows = await db
    .select()
    .from(employerProfiles)
    .where(eq(employerProfiles.user_id, userOrRes.id))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  return NextResponse.json({ profile: rows[0] });
}

export async function PATCH(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = updateEmployerMeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const updated = await db
    .update(employerProfiles)
    .set(data)
    .where(eq(employerProfiles.user_id, userOrRes.id))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.not_found") },
      { status: 404 }
    );
  }

  return NextResponse.json({ profile: updated[0] });
}
