import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { shiftStatusSchema } from "@/lib/validators";
import { UserRole, ShiftStatus } from "@/lib/constants";
import { eq, and } from "drizzle-orm";

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  [ShiftStatus.DRAFT]: [ShiftStatus.PUBLISHED, ShiftStatus.CANCELLED],
  [ShiftStatus.PUBLISHED]: [ShiftStatus.CANCELLED],
};

// PATCH /api/shifts/:id/status — change shift status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRole(req, UserRole.EMPLOYER);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const parsed = shiftStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || "שגיאת אימות" },
      { status: 400 }
    );
  }

  const newStatus = parsed.data.status;

  // Fetch shift
  const existing = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, params.id), eq(shifts.employer_id, user.id)))
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "NOT_FOUND", message: "משמרת לא נמצאה" }, { status: 404 });
  }

  const shift = existing[0];
  const allowed = VALID_TRANSITIONS[shift.status] || [];

  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: "INVALID_TRANSITION", message: `לא ניתן לעבור מ-${shift.status} ל-${newStatus}` },
      { status: 400 }
    );
  }

  const updated = await db
    .update(shifts)
    .set({ status: newStatus, updated_at: new Date() })
    .where(eq(shifts.id, params.id))
    .returning();

  return NextResponse.json({ shift: updated[0] });
}
