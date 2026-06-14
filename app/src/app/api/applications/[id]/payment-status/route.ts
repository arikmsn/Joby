import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, notifications } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { UserRole, PAYABLE_STATUSES, PaymentStatus } from "@/lib/constants";
import { updatePaymentStatusSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

const NEXT_STATUS: Record<string, string> = {
  [PaymentStatus.PENDING]: PaymentStatus.APPROVED_FOR_PAYMENT,
  [PaymentStatus.APPROVED_FOR_PAYMENT]: PaymentStatus.PAID,
};

// PATCH /api/applications/[id]/payment-status
// Admin-only operational status transition (PENDING -> APPROVED_FOR_PAYMENT -> PAID).
// This marks internal payment-tracking state only — no real money movement.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = updatePaymentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }

  const appId = params.id;
  const { payment_status: newStatus } = parsed.data;

  const appRows = await db
    .select({
      id: applications.id,
      shift_id: applications.shift_id,
      worker_id: applications.worker_id,
      status: applications.status,
      payment_status: applications.payment_status,
    })
    .from(applications)
    .where(eq(applications.id, appId))
    .limit(1);

  if (appRows.length === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: t("error.not_found") }, { status: 404 });
  }

  const app = appRows[0];

  if (!PAYABLE_STATUSES.includes(app.status as (typeof PAYABLE_STATUSES)[number])) {
    return NextResponse.json({ error: "INVALID_STATUS", message: t("error.invalid_transition") }, { status: 400 });
  }

  if (NEXT_STATUS[app.payment_status] !== newStatus) {
    return NextResponse.json({ error: "INVALID_STATUS", message: t("error.invalid_transition") }, { status: 400 });
  }

  const shiftRows = await db
    .select({ title: shifts.title })
    .from(shifts)
    .where(eq(shifts.id, app.shift_id))
    .limit(1);
  const shiftTitle = shiftRows[0]?.title || "";

  const timestampField =
    newStatus === PaymentStatus.APPROVED_FOR_PAYMENT
      ? { approved_for_payment_at: sql`now()` }
      : { paid_at: sql`now()` };

  const updated = await db
    .update(applications)
    .set({
      payment_status: newStatus,
      updated_at: sql`now()`,
      ...timestampField,
    })
    .where(eq(applications.id, appId))
    .returning();

  const notif: { type: string; titleKey: Parameters<typeof t>[0]; bodyKey: Parameters<typeof t>[0] } =
    newStatus === PaymentStatus.APPROVED_FOR_PAYMENT
      ? { type: "PAYMENT_APPROVED", titleKey: "notification.payment_approved.title", bodyKey: "notification.payment_approved.body" }
      : { type: "PAYMENT_PAID", titleKey: "notification.payment_paid.title", bodyKey: "notification.payment_paid.body" };

  await db.insert(notifications).values({
    user_id: app.worker_id,
    type: notif.type,
    title: t(notif.titleKey),
    body: t(notif.bodyKey).replace("{title}", shiftTitle),
    payload: { shift_id: app.shift_id, application_id: appId },
    channel: "in_app",
  });

  return NextResponse.json({ application: updated[0] });
}
