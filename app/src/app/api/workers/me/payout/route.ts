import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerProfiles } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { updatePayoutDetailsSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

const PAYOUT_FIELDS = [
  "payout_legal_name",
  "payout_id_number",
  "payout_bank_name",
  "payout_bank_branch",
  "payout_account_number",
  "payout_account_holder",
] as const;

function selectPayoutFields() {
  return {
    payout_legal_name: workerProfiles.payout_legal_name,
    payout_id_number: workerProfiles.payout_id_number,
    payout_bank_name: workerProfiles.payout_bank_name,
    payout_bank_branch: workerProfiles.payout_bank_branch,
    payout_account_number: workerProfiles.payout_account_number,
    payout_account_holder: workerProfiles.payout_account_holder,
    payout_details_completed_at: workerProfiles.payout_details_completed_at,
    supplier_type: workerProfiles.supplier_type,
    tax_id: workerProfiles.tax_id,
    payout_ready: workerProfiles.payout_ready,
  };
}

function computePayoutReady(data: Record<string, unknown>): boolean {
  const bankFieldsFilled = PAYOUT_FIELDS.every(
    (f) => !!data[f] && String(data[f]).trim() !== ""
  );
  if (!bankFieldsFilled) return false;
  const st = data.supplier_type as string | null;
  if (!st) return false;
  if (st === "freelancer_licensed" || st === "company") {
    if (!data.tax_id || String(data.tax_id).trim() === "") return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const rows = await db
    .select(selectPayoutFields())
    .from(workerProfiles)
    .where(eq(workerProfiles.user_id, userOrRes.id))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  return NextResponse.json({ payout: rows[0] });
}

export async function PATCH(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = updatePayoutDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const current = await db
    .select(selectPayoutFields())
    .from(workerProfiles)
    .where(eq(workerProfiles.user_id, userOrRes.id))
    .limit(1);

  if (current.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const merged = { ...current[0], ...data };
  const isComplete = PAYOUT_FIELDS.every((f) => !!merged[f] && String(merged[f]).trim() !== "");
  const isReady = computePayoutReady(merged as Record<string, unknown>);

  const updated = await db
    .update(workerProfiles)
    .set({
      ...data,
      payout_details_completed_at: isComplete ? sql`now()` : null,
      payout_ready: isReady,
    })
    .where(eq(workerProfiles.user_id, userOrRes.id))
    .returning(selectPayoutFields());

  return NextResponse.json({ payout: updated[0] });
}
