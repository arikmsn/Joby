import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, workerProfiles, employerWorkerRelations } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { workerSearchByPhoneSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";
import { phoneVariants } from "@/lib/phone";

// GET /api/employers/known-workers/search?phone=... — find an existing worker by phone for invite
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const phone = req.nextUrl.searchParams.get("phone") || "";
  const parsed = workerSearchByPhoneSchema.safeParse({ phone });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.phone_invalid") },
      { status: 400 }
    );
  }

  const variants = phoneVariants(parsed.data.phone);

  const rows = await db
    .select({
      id: users.id,
      full_name: users.full_name,
      phone: users.phone,
      city: workerProfiles.city,
      trust_score: workerProfiles.trust_score,
      total_shifts: workerProfiles.total_shifts,
    })
    .from(users)
    .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
    .where(and(inArray(users.phone, variants), eq(users.role, UserRole.WORKER)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ worker: null });
  }

  const worker = rows[0];

  const relationRows = await db
    .select({ id: employerWorkerRelations.id })
    .from(employerWorkerRelations)
    .where(and(eq(employerWorkerRelations.employer_id, user.id), eq(employerWorkerRelations.worker_id, worker.id)))
    .limit(1);

  return NextResponse.json({ worker: { ...worker, connected: relationRows.length > 0 } });
}
