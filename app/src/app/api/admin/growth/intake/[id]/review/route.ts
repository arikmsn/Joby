import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidateSubmissions } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { intakeReviewSchema } from "@/lib/growth/validators";
import { GrowthPermission } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// POST /api/admin/growth/intake/[id]/review — re-tag / score / flag a
// submission. Scores are completeness+relevance only, never protected
// traits (execution pack S6.2). Returns the masked shape (no PII fields).
export const POST = withGrowthAuth(
  GrowthPermission.INTAKE_REVIEW,
  async (req: NextRequest, actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = intakeReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { review_status, role_families, quality_score } = parsed.data;

    const [updated] = await db
      .update(candidateSubmissions)
      .set({
        review_status,
        ...(role_families ? { role_families } : {}),
        ...(quality_score !== undefined ? { quality_score } : {}),
      })
      .where(eq(candidateSubmissions.id, id))
      .returning({
        id: candidateSubmissions.id,
        review_status: candidateSubmissions.review_status,
        role_families: candidateSubmissions.role_families,
        quality_score: candidateSubmissions.quality_score,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  }
);
