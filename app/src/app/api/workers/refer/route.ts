import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerInvites } from "@/lib/schema";
import { sql } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { referFriendSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";
import { normalizePhone } from "@/lib/phone";
import { sendSMS } from "@/lib/sms";

// POST /api/workers/refer — refer a friend to Joby via WhatsApp
export async function POST(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = referFriendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("profile.refer_friend_invalid_phone") },
      { status: 400 }
    );
  }

  const { phone } = parsed.data;
  const normalized = normalizePhone(phone);

  const firstName = user.full_name?.split(" ")[0] || user.full_name;
  const message = t("notification.refer_friend.whatsapp")
    .replace("{name}", firstName)
    .replace("{link}", "https://joby-opal.vercel.app/login");

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
      { error: "SMS_FAILED", message: t("profile.refer_friend_error") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: t("profile.refer_friend_success") });
}
