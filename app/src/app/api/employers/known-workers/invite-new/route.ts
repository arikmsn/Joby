import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, employerProfiles, workerInvites } from "@/lib/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { inviteNewWorkerSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";
import { normalizePhone, phoneVariants } from "@/lib/phone";
import { sendSMS } from "@/lib/sms";

// POST /api/employers/known-workers/invite-new — invite a phone number that is not yet on Joby via WhatsApp
export async function POST(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = inviteNewWorkerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.phone_invalid") },
      { status: 400 }
    );
  }

  const { phone } = parsed.data;
  const normalized = normalizePhone(phone);
  const variants = phoneVariants(phone);

  const existingWorker = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.phone, variants), eq(users.role, UserRole.WORKER)))
    .limit(1);

  if (existingWorker.length > 0) {
    return NextResponse.json(
      { error: "WORKER_EXISTS", message: t("known_workers.worker_already_exists") },
      { status: 409 }
    );
  }

  const employerRows = await db
    .select({ business_name: employerProfiles.business_name })
    .from(employerProfiles)
    .where(eq(employerProfiles.user_id, user.id))
    .limit(1);
  const employerName = employerRows[0]?.business_name || user.full_name;

  const message = t("notification.worker_invite.whatsapp").replace("{employer}", employerName);
  const result = await sendSMS(normalized, message);

  const status = result.success ? "PENDING" : "FAILED";

  await db
    .insert(workerInvites)
    .values({
      employer_id: user.id,
      invited_by_user_id: user.id,
      invited_phone: phone,
      normalized_phone: normalized,
      status,
      sent_at: sql`now()`,
      message_provider: process.env.OTP_PROVIDER || "mock",
      provider_message_id: result.messageId || null,
      last_error: result.success ? null : result.error || null,
    })
    .onConflictDoUpdate({
      target: [workerInvites.employer_id, workerInvites.normalized_phone],
      set: {
        invited_phone: phone,
        status,
        sent_at: sql`now()`,
        message_provider: process.env.OTP_PROVIDER || "mock",
        provider_message_id: result.messageId || null,
        last_error: result.success ? null : result.error || null,
        updated_at: sql`now()`,
      },
    });

  if (!result.success) {
    return NextResponse.json(
      { error: "SMS_FAILED", message: t("known_workers.invite_whatsapp_failed") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, status });
}
