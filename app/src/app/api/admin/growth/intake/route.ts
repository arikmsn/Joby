import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidateSubmissions, candidates, landingPages } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { intakeFilterSchema } from "@/lib/growth/validators";
import { maskPhone } from "@/lib/growth/dto";
import { GrowthPermission } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

// GET /api/admin/growth/intake — submission review queue.
// MASKED BY DEFAULT (execution pack S2.2/S6.2): phone masked, email and
// CV ref never included. Unmasking is a separate, audited endpoint behind
// growth:candidates.pii.
export const GET = withGrowthAuth(
  GrowthPermission.INTAKE_READ,
  async (req: NextRequest) => {
    const url = new URL(req.url);
    const parsed = intakeFilterSchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }
    const { review_status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const where = review_status
      ? eq(candidateSubmissions.review_status, review_status)
      : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: candidateSubmissions.id,
          candidate_id: candidateSubmissions.candidate_id,
          role_families: candidateSubmissions.role_families,
          availability: candidateSubmissions.availability,
          quality_score: candidateSubmissions.quality_score,
          completeness_score: candidateSubmissions.completeness_score,
          review_status: candidateSubmissions.review_status,
          submitted_at: candidateSubmissions.submitted_at,
          lp_slug: landingPages.slug,
          // masked-DTO inputs only — email/cv_file_ref deliberately not selected
          candidate_name: candidates.full_name,
          candidate_phone: candidates.phone,
          candidate_city: candidates.city,
          candidate_region: candidates.region_code,
          consent_marketing_at: candidates.consent_marketing_at,
        })
        .from(candidateSubmissions)
        .innerJoin(
          candidates,
          eq(candidateSubmissions.candidate_id, candidates.id)
        )
        .leftJoin(
          landingPages,
          eq(candidateSubmissions.landing_page_id, landingPages.id)
        )
        .where(where)
        .orderBy(desc(candidateSubmissions.submitted_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(candidateSubmissions)
        .where(where),
    ]);

    // Apply masking before anything leaves the handler
    const data = rows.map((r) => ({
      id: r.id,
      candidate_id: r.candidate_id,
      candidate_name: r.candidate_name,
      phone_masked: maskPhone(r.candidate_phone),
      city: r.candidate_city,
      region_code: r.candidate_region,
      consent_marketing: !!r.consent_marketing_at,
      role_families: r.role_families,
      availability: r.availability,
      quality_score: r.quality_score,
      completeness_score: r.completeness_score,
      review_status: r.review_status,
      submitted_at: r.submitted_at,
      lp_slug: r.lp_slug,
    }));

    return NextResponse.json({
      data,
      total: countResult[0]?.count || 0,
      page,
      limit,
    });
  }
);
