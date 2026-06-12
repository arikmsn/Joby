import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { shifts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { generateQrToken } from "@/lib/qr";
import { t } from "@/lib/i18n/he";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const shiftId = params.id;
  const mode = (req.nextUrl.searchParams.get("mode") || "CHECK_IN") as "CHECK_IN" | "CHECK_OUT";

  if (mode !== "CHECK_IN" && mode !== "CHECK_OUT") {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  // Verify employer owns shift
  const shiftRows = await db
    .select({ employer_id: shifts.employer_id })
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (shiftRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.shift_not_found") }, { status: 404 });
  }
  if (shiftRows[0].employer_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN", message: t("error.forbidden") }, { status: 403 });
  }

  const token = await generateQrToken(shiftId, mode);

  return NextResponse.json({ token, mode, shiftId });
}
