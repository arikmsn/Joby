import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { employerWorkerRelations } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { togglePreferredWorkerSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

// PATCH /api/employers/known-workers/[workerId] — toggle preferred flag
export async function PATCH(
  req: NextRequest,
  { params }: { params: { workerId: string } }
) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = togglePreferredWorkerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const { is_preferred } = parsed.data;
  const workerId = params.workerId;

  const existing = await db
    .select({ id: employerWorkerRelations.id })
    .from(employerWorkerRelations)
    .where(and(eq(employerWorkerRelations.employer_id, user.id), eq(employerWorkerRelations.worker_id, workerId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(employerWorkerRelations)
      .set({ is_preferred, updated_at: sql`now()` })
      .where(eq(employerWorkerRelations.id, existing[0].id));
  } else {
    await db.insert(employerWorkerRelations).values({
      employer_id: user.id,
      worker_id: workerId,
      is_preferred,
    });
  }

  return NextResponse.json({ ok: true, is_preferred });
}
