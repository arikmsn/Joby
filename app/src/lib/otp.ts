// ============================================================
// Joby/ShiftMatch — OTP generation and verification
// TODO(PROD): Replace in-memory store with Redis or DB-backed store
// ============================================================

import { Config } from "./constants";
import { sendSMS } from "./sms";

interface OTPEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}

// TODO(PROD): Replace with Redis/DB store for multi-instance deployments
const otpStore = new Map<string, OTPEntry>();
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function generateOTP(): string {
  const digits = Config.OTP_LENGTH;
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

export function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(phone);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(phone, {
      count: 1,
      resetAt: now + 60 * 60 * 1000, // 1 hour window
    });
    return true;
  }

  if (entry.count >= Config.OTP_RATE_LIMIT_PER_HOUR) {
    return false;
  }

  entry.count++;
  return true;
}

export async function createAndSendOTP(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  if (!checkRateLimit(phone)) {
    return { success: false, error: "RATE_LIMITED" };
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + Config.OTP_EXPIRY_MINUTES * 60 * 1000;

  otpStore.set(phone, { otp, expiresAt, attempts: 0 });

  const result = await sendSMS(phone, `קוד האימות שלך ב-Joby: ${otp}`);

  if (!result.success) {
    return { success: false, error: "SMS_FAILED" };
  }

  // TODO(PROD): Remove console log in production
  console.log(`[OTP DEV] Phone: ${phone} | OTP: ${otp}`);

  return { success: true };
}

export function verifyOTP(
  phone: string,
  otp: string
): { valid: boolean; error?: string } {
  const entry = otpStore.get(phone);

  if (!entry) {
    return { valid: false, error: "OTP_NOT_FOUND" };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, error: "OTP_EXPIRED" };
  }

  entry.attempts++;
  if (entry.attempts > 5) {
    otpStore.delete(phone);
    return { valid: false, error: "TOO_MANY_ATTEMPTS" };
  }

  if (entry.otp !== otp) {
    return { valid: false, error: "INVALID_OTP" };
  }

  // OTP is valid — consume it
  otpStore.delete(phone);
  return { valid: true };
}
