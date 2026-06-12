import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, workerProfiles } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { findOverlap } from "@/lib/overlap";
import { t } from "@/lib/i18n/he";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const shiftId = params.id;

  // Get shift
  const shiftRows = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (shiftRows.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.shift_not_found") },
      { status: 404 }
    );
  }

  const shift = shiftRows[0];

  if (shift.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "NOT_PUBLISHED", message: t("apply.shift_not_published") },
      { status: 400 }
    );
  }

  // Check min trust score
  const minTrust = parseFloat(shift.min_trust_score?.toString() || "0");
  if (minTrust > 0) {
    const wpRows = await db
      .select({ trust_score: workerProfiles.trust_score })
      .from(workerProfiles)
      .where(eq(workerProfiles.user_id, user.id))
      .limit(1);

    const workerTrust = parseFloat(wpRows[0]?.trust_score?.toString() || "5.00");
    if (workerTrust < minTrust) {
      return NextResponse.json(
        { error: "LOW_TRUST", message: t("trust.below_minimum") },
        { status: 403 }
      );
    }
  }

  // Check duplicate
  const existing = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.shift_id, shiftId),
        eq(applications.worker_id, user.id)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "DUPLICATE", message: t("apply.already_applied") },
      { status: 409 }
    );
  }

  // Check overlap
  const overlapTitle = await findOverlap(
    user.id,
    new Date(shift.start_at!),
    new Date(shift.end_at!),
    shiftId
  );

  if (overlapTitle) {
    return NextResponse.json(
      { error: "OVERLAP", message: `${t("apply.overlap")}: ${overlapTitle}` },
      { status: 409 }
    );
  }

  // Create application
  const inserted = await db
    .insert(applications)
    .values({
      shift_id: shiftId,
      worker_id: user.id,
    })
    .returning();

  return NextResponse.json(
    { application: inserted[0], message: t("apply.success") },
    { status: 201 }
  );
}
