import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidateSubmissions, candidates } from "@/lib/schema";
import { withGrowthAuth } from "@/lib/growth/auth";
import { logGrowthAudit } from "@/lib/growth/audit";
import { unmaskSchema } from "@/lib/growth/validators";
import { GrowthPermission, GrowthAuditAction } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// POST /api/admin/growth/intake/[id]/unmask — reveal a candidate's contact
// details for one submission. Requires growth:candidates.pii (super_admin
// in the current role map), a reason string, and EVERY call is audited
// (PII_UNMASKED) — execution pack S2.2.
export const POST = withGrowthAuth(
  GrowthPermission.CANDIDATES_PII,
  async (req: NextRequest, actor, ctx) => {
    const id = ctx.params?.id;
    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = unmaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", message: t("error.validation") },
        { status: 400 }
      );
    }

    const rows = await db
      .select({
        candidate_id: candidates.id,
        full_name: candidates.full_name,
        phone: candidates.phone,
        email: candidates.email,
        city: candidates.city,
      })
      .from(candidateSubmissions)
      .innerJoin(
        candidates,
        eq(candidateSubmissions.candidate_id, candidates.id)
      )
      .where(eq(candidateSubmissions.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: t("error.validation") },
        { status: 404 }
      );
    }

    // Audit BEFORE returning PII — the reason is required and recorded;
    // entity ids only, never the values themselves.
    await logGrowthAudit({
      actor_id: actor.id,
      action: GrowthAuditAction.PII_UNMASKED,
      entity_type: "candidate",
      entity_id: row.candidate_id,
      reason: parsed.data.reason,
    });

    return NextResponse.json({
      data: {
        candidate_id: row.candidate_id,
        full_name: row.full_name,
        phone: row.phone,
        email: row.email,
        city: row.city,
      },
    });
  }
);
