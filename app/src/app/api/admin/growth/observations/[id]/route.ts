import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceJobs } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { updateObservationSchema } from "@/lib/growth/validators";
import { GrowthPermission, GrowthSubRole } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// PATCH /api/admin/growth/observations/[id] — corrections + review-queue
// resolution. Own-row rule: growth_analyst may edit only rows they created;
// growth_ops / super_admin may edit any row.
export const PATCH = withGrowthAuth(
  GrowthPermission.OBSERVATIONS_WRITE,
  async (req: NextRequest, actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = updateObservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION",
          message: t("error.validation"),
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const rows = await db
      .select({ id: sourceJobs.id, created_by: sourceJobs.created_by })
      .from(sourceJobs)
      .where(eq(sourceJobs.id, id))
      .limit(1);
    if (!rows[0]) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    if (
      actor.admin_sub_role === GrowthSubRole.GROWTH_ANALYST &&
      rows[0].created_by !== actor.id
    ) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: t("error.forbidden") },
        { status: 403 }
      );
    }

    const { resolve_review, salary_min, salary_max, ...rest } = parsed.data;

    const [updated] = await db
      .update(sourceJobs)
      .set({
        ...rest,
        ...(salary_min !== undefined
          ? { salary_min: salary_min != null ? String(salary_min) : null }
          : {}),
        ...(salary_max !== undefined
          ? { salary_max: salary_max != null ? String(salary_max) : null }
          : {}),
        ...(resolve_review
          ? {
              needs_review: false,
              review_resolved_by: actor.id,
              // DB clock, not app clock — created_at is DB-set, and the
              // review-time metric subtracts the two (clock skew made
              // durations negative when this used new Date())
              review_resolved_at: sql`now()`,
            }
          : {}),
        updated_at: new Date(),
      })
      .where(eq(sourceJobs.id, id))
      .returning({
        id: sourceJobs.id,
        needs_review: sourceJobs.needs_review,
        updated_at: sourceJobs.updated_at,
      });

    return NextResponse.json({ data: updated });
  }
);
