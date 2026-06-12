import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, employerProfiles, workerProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;

  const user = result;

  // Fetch full user record
  const fullRows = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const fullUser = fullRows[0] ?? null;

  // Fetch role-specific profile
  let profile = null;
  if (user.role === UserRole.EMPLOYER) {
    const rows = await db
      .select()
      .from(employerProfiles)
      .where(eq(employerProfiles.user_id, user.id))
      .limit(1);
    profile = rows[0] ?? null;
  } else if (user.role === UserRole.WORKER) {
    const rows = await db
      .select()
      .from(workerProfiles)
      .where(eq(workerProfiles.user_id, user.id))
      .limit(1);
    profile = rows[0] ?? null;
  }

  return NextResponse.json({ user: fullUser, profile });
}
