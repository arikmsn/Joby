import { NextResponse } from "next/server";
import { rawSql } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const otpResult = await rawSql`
    DELETE FROM otp_codes WHERE expires_at < now() RETURNING phone
  `;
  const rateResult = await rawSql`
    DELETE FROM otp_rate_limits WHERE reset_at < now() RETURNING phone
  `;

  return NextResponse.json({
    message: `Cleaned ${otpResult.length} expired OTPs, ${rateResult.length} expired rate limits`,
    expired_otps: otpResult.length,
    expired_rate_limits: rateResult.length,
  });
}
