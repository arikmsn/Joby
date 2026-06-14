import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, user.id))
    .orderBy(desc(notifications.created_at))
    .limit(50);

  const unreadRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.user_id, user.id), eq(notifications.is_read, false)));

  return NextResponse.json({
    notifications: rows,
    unread_count: Number(unreadRows[0]?.count || 0),
  });
}
