import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, ratings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { recalcTrustScore } from "@/lib/trust";
import { t } from "@/lib/i18n/he";
import { sql } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const appId = params.id;

  let body: { score: number; flag?: string; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "VALIDATION", message: "גוף בקשה לא תקין" },
      { status: 400 }
    );
  }

  // Validate score
  const score = body.score;
  if (!score || !Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json(
      { error: "VALIDATION", message: "דירוג חייב להיות בין 1 ל-5" },
      { status: 400 }
    );
  }

  // Fetch application
  const appRows = await db
    .select()
    .from(applications)
    .where(eq(applications.id, appId))
    .limit(1);

  if (appRows.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.not_found") },
      { status: 404 }
    );
  }

  const app = appRows[0];

  // Check application is CHECKED_OUT
  if (app.status !== "CHECKED_OUT") {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: t("rating.not_checked_out") },
      { status: 400 }
    );
  }

  // Verify employer owns the shift
  const shiftRows = await db
    .select({ employer_id: shifts.employer_id })
    .from(shifts)
    .where(eq(shifts.id, app.shift_id))
    .limit(1);

  if (shiftRows.length === 0 || shiftRows[0].employer_id !== user.id) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: t("rating.not_your_shift") },
      { status: 403 }
    );
  }

  // Check no existing rating for this application
  const existingRating = await db
    .select({ id: ratings.id })
    .from(ratings)
    .where(eq(ratings.application_id, appId))
    .limit(1);

  if (existingRating.length > 0) {
    return NextResponse.json(
      { error: "ALREADY_RATED", message: t("rating.already_rated") },
      { status: 409 }
    );
  }

  // Create rating
  const ratingRows = await db
    .insert(ratings)
    .values({
      application_id: appId,
      shift_id: app.shift_id,
      worker_id: app.worker_id,
      employer_id: user.id,
      score,
      flag: body.flag || null,
      comment: body.comment || null,
    })
    .returning();

  // Update application status to RATED
  await db
    .update(applications)
    .set({
      status: "RATED",
      updated_at: sql`now()`,
    })
    .where(eq(applications.id, appId));

  // Recalculate trust score
  await recalcTrustScore(app.worker_id);

  return NextResponse.json({
    rating: ratingRows[0],
    message: t("rating.success"),
  }, { status: 201 });
}
