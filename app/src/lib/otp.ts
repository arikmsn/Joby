// ============================================================
// Joby — OTP generation and verification (DB-backed via Neon)
// ============================================================

import { Config } from "./constants";
import { sendSMS } from "./sms";
import { normalizePhone } from "./phone";
import { rawSql } from "./db";

function generateOTP(): string {
  const digits = Config.OTP_LENGTH;
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

export async function checkRateLimit(phone: string): Promise<boolean> {
  const rows = await rawSql`
    INSERT INTO otp_rate_limits (phone, count, reset_at)
    VALUES (${phone}, 1, now() + interval '1 hour')
    ON CONFLICT (phone) DO UPDATE SET
      count = CASE
        WHEN otp_rate_limits.reset_at <= now() THEN 1
        ELSE otp_rate_limits.count + 1
      END,
      reset_at = CASE
        WHEN otp_rate_limits.reset_at <= now() THEN now() + interval '1 hour'
        ELSE otp_rate_limits.reset_at
      END
    RETURNING count, reset_at
  `;

  const entry = rows[0];
  if (!entry) return true;
  if (new Date(entry.reset_at as string) <= new Date()) return true;
  return (entry.count as number) <= Config.OTP_RATE_LIMIT_PER_HOUR;
}

// Returns true only when every condition for debug OTP exposure is met:
// - OTP_DEBUG_MODE=expose (master switch)
// - the phone is on OTP_DEBUG_ALLOWLIST
// - OTP_DEBUG_SECRET is set AND the caller presented a matching secret
function isDebugExposureAllowed(phone: string, debugSecret: string | null | undefined): boolean {
  if (process.env.OTP_DEBUG_MODE !== "expose") return false;

  const configuredSecret = process.env.OTP_DEBUG_SECRET;
  if (!configuredSecret || !debugSecret || debugSecret !== configuredSecret) return false;

  const allowlist = (process.env.OTP_DEBUG_ALLOWLIST || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => normalizePhone(p));
  if (allowlist.length === 0) return false;

  return allowlist.includes(normalizePhone(phone));
}

export async function createAndSendOTP(
  phone: string,
  debugSecret?: string | null
): Promise<{ success: boolean; error?: string; debugOtp?: string; providerStatus?: string }> {
  const allowed = await checkRateLimit(phone);
  if (!allowed) {
    return { success: false, error: "RATE_LIMITED" };
  }

  const otp = generateOTP();
  const expiryMinutes = Config.OTP_EXPIRY_MINUTES;

  await rawSql`
    INSERT INTO otp_codes (phone, otp, expires_at, attempts)
    VALUES (${phone}, ${otp}, now() + ${expiryMinutes + " minutes"}::interval, 0)
    ON CONFLICT (phone) DO UPDATE SET
      otp = ${otp},
      expires_at = now() + ${expiryMinutes + " minutes"}::interval,
      attempts = 0,
      created_at = now()
  `;

  console.log(`[OTP] created phone=${normalizePhone(phone)} expiresInMin=${expiryMinutes}`);

  const result = await sendSMS(phone, `קוד ההתחברות שלך ל-Joby הוא: ${otp}`);
  const debugExposureAllowed = isDebugExposureAllowed(phone, debugSecret);

  if (!result.success) {
    console.error(`[OTP] send failed phone=${normalizePhone(phone)} reason=${result.error}`);

    if (debugExposureAllowed && process.env.OTP_ALLOW_PROVIDER_FALLBACK === "true") {
      console.warn(`[OTP] debug fallback used phone=${normalizePhone(phone)}`);
      return { success: true, debugOtp: otp, providerStatus: "send_failed_fallback_used" };
    }

    return { success: false, error: "SMS_FAILED" };
  }

  console.log(`[OTP] send ok phone=${normalizePhone(phone)} messageId=${result.messageId ?? "n/a"}`);

  return { success: true, ...(debugExposureAllowed ? { debugOtp: otp } : {}) };
}

export async function verifyOTP(
  phone: string,
  otp: string
): Promise<{ valid: boolean; error?: string }> {
  const logPhone = normalizePhone(phone);

  const rows = await rawSql`
    SELECT otp, expires_at, attempts FROM otp_codes WHERE phone = ${phone}
  `;

  if (rows.length === 0) {
    console.warn(`[OTP] verify rejected phone=${logPhone} reason=OTP_NOT_FOUND`);
    return { valid: false, error: "OTP_NOT_FOUND" };
  }

  const entry = rows[0];
  const expiresAt = new Date(entry.expires_at as string);

  if (new Date() > expiresAt) {
    await rawSql`DELETE FROM otp_codes WHERE phone = ${phone}`;
    console.warn(`[OTP] verify rejected phone=${logPhone} reason=OTP_EXPIRED`);
    return { valid: false, error: "OTP_EXPIRED" };
  }

  const attempts = (entry.attempts as number) + 1;

  if (attempts > 5) {
    await rawSql`DELETE FROM otp_codes WHERE phone = ${phone}`;
    console.warn(`[OTP] verify rejected phone=${logPhone} reason=TOO_MANY_ATTEMPTS`);
    return { valid: false, error: "TOO_MANY_ATTEMPTS" };
  }

  await rawSql`UPDATE otp_codes SET attempts = ${attempts} WHERE phone = ${phone}`;

  if (entry.otp !== otp) {
    console.warn(`[OTP] verify rejected phone=${logPhone} reason=INVALID_OTP attempt=${attempts}`);
    return { valid: false, error: "INVALID_OTP" };
  }

  await rawSql`DELETE FROM otp_codes WHERE phone = ${phone}`;
  console.log(`[OTP] verify ok phone=${logPhone}`);
  return { valid: true };
}
