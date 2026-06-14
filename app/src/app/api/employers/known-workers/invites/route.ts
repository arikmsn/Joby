import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerInvites } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { UserRole } from "@/lib/constants";

// GET /api/employers/known-workers/invites — invites this employer sent to phone numbers not yet on Joby
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const rows = await db
    .select({
      id: workerInvites.id,
      invited_phone: workerInvites.invited_phone,
      normalized_phone: workerInvites.normalized_phone,
      status: workerInvites.status,
      sent_at: workerInvites.sent_at,
      joined_at: workerInvites.joined_at,
    })
    .from(workerInvites)
    .where(eq(workerInvites.employer_id, user.id))
    .orderBy(desc(workerInvites.sent_at));

  return NextResponse.json({ invites: rows });
}
