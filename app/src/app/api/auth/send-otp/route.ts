import { NextRequest, NextResponse } from "next/server";
import { sendOtpSchema } from "@/lib/validators";
import { createAndSendOTP } from "@/lib/otp";
import { t } from "@/lib/i18n/he";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const parsed = sendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.phone_invalid") },
      { status: 400 }
    );
  }

  const { phone } = parsed.data;
  const result = await createAndSendOTP(phone);

  if (!result.success) {
    if (result.error === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: t("error.rate_limited") },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "SMS_FAILED", message: t("error.sms_failed") },
      { status: 500 }
    );
  }

  return NextResponse.json({ sent: true });
}
