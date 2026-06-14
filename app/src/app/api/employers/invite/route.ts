import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { shifts, users, employerProfiles, notifications } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { inviteWorkerSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// POST /api/employers/invite — invite a known/existing worker to a specific shift (in-app notification only)
export async function POST(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = inviteWorkerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const { worker_id, shift_id } = parsed.data;

  const shiftRows = await db
    .select({
      id: shifts.id,
      employer_id: shifts.employer_id,
      title: shifts.title,
      start_at: shifts.start_at,
      status: shifts.status,
    })
    .from(shifts)
    .where(eq(shifts.id, shift_id))
    .limit(1);

  if (shiftRows.length === 0 || shiftRows[0].employer_id !== user.id) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: t("error.forbidden") },
      { status: 403 }
    );
  }

  const shift = shiftRows[0];
  if (shift.status !== ShiftStatus.PUBLISHED) {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: t("apply.shift_not_published") },
      { status: 400 }
    );
  }

  const workerRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, worker_id), eq(users.role, UserRole.WORKER)))
    .limit(1);

  if (workerRows.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.not_found") },
      { status: 404 }
    );
  }

  const employerRows = await db
    .select({ business_name: employerProfiles.business_name })
    .from(employerProfiles)
    .where(eq(employerProfiles.user_id, user.id))
    .limit(1);
  const employerName = employerRows[0]?.business_name || user.full_name;

  const shiftDate = new Date(shift.start_at).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  await db.insert(notifications).values({
    user_id: worker_id,
    type: "SHIFT_INVITE",
    title: t("notification.shift_invite.title"),
    body: t("notification.shift_invite.body")
      .replace("{employer}", employerName)
      .replace("{title}", shift.title)
      .replace("{date}", shiftDate),
    payload: { shift_id: shift.id },
    channel: "in_app",
  });

  return NextResponse.json({ ok: true });
}
