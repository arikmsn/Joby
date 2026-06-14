import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { t } from "@/lib/i18n/he";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const updated = await db
    .update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.id, params.id), eq(notifications.user_id, user.id)))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  return NextResponse.json({ notification: updated[0] });
}
