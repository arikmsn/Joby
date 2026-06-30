// ============================================================
// Joby — QR token generation & validation (HMAC-based)
// ============================================================

import { Config } from "./constants";

function getQrSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}
const QR_SECRET = getQrSecret();

/**
 * Generate a signed QR token for check-in/out.
 * Format: shiftId:mode:timestamp:signature
 */
export async function generateQrToken(
  shiftId: string,
  mode: "CHECK_IN" | "CHECK_OUT"
): Promise<string> {
  const timestamp = Date.now().toString();
  const payload = `${shiftId}:${mode}:${timestamp}`;
  const signature = await hmacSign(payload);
  return `${payload}:${signature}`;
}

/**
 * Validate and parse a QR token.
 * Returns parsed data or null if invalid/expired.
 */
export async function validateQrToken(
  token: string
): Promise<{ shiftId: string; mode: "CHECK_IN" | "CHECK_OUT" } | null> {
  const parts = token.split(":");
  if (parts.length !== 4) return null;

  const [shiftId, mode, timestamp, signature] = parts;

  if (mode !== "CHECK_IN" && mode !== "CHECK_OUT") return null;

  // Verify signature (constant-time to avoid leaking via comparison timing)
  const payload = `${shiftId}:${mode}:${timestamp}`;
  const expected = await hmacSign(payload);
  if (!timingSafeEqual(signature, expected)) return null;

  // Check expiry
  const tokenTime = parseInt(timestamp, 10);
  if (isNaN(tokenTime)) return null;

  const ageMs = Date.now() - tokenTime;
  const maxAgeMs = Config.QR_TOKEN_TTL_MINUTES * 60 * 1000;
  if (ageMs > maxAgeMs || ageMs < 0) return null;

  return { shiftId, mode: mode as "CHECK_IN" | "CHECK_OUT" };
}

/**
 * Constant-time string comparison. The signatures are fixed-length hex
 * (SHA-256 → 64 chars), so the early length check leaks nothing useful while
 * the XOR loop avoids early-exit timing differences on the secret-derived part.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSign(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(QR_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  // Convert to hex
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
