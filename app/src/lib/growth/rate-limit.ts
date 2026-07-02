// ============================================================
// Growth Engine — DB-backed rate limiter for the public intake
// endpoint (serverless-safe, mirrors the otp_rate_limits pattern).
// Keys are salted SHA-256 hashes — raw IPs/phones are never stored
// or logged (log-hygiene by construction).
// ============================================================

import { createHash } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { intakeRateLimits } from "@/lib/schema";

const WINDOW_MINUTES = 60;

function hashKey(prefix: string, value: string): string {
  const salt = process.env.JWT_SECRET ?? "";
  const digest = createHash("sha256")
    .update(`${value}|${salt}`, "utf8")
    .digest("hex");
  // 80-char column: prefix + 64-hex digest fits
  return `${prefix}:${digest.slice(0, 64)}`;
}

/**
 * Consume one unit for the given key. Returns true when the request is
 * allowed, false when the hourly limit is exceeded.
 */
export async function consumeIntakeRateLimit(
  prefix: "ip" | "phone",
  value: string,
  limit: number
): Promise<boolean> {
  const key = hashKey(prefix, value);
  const now = new Date();
  const resetAt = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);

  const rows = await db
    .select({
      count: intakeRateLimits.count,
      reset_at: intakeRateLimits.reset_at,
    })
    .from(intakeRateLimits)
    .where(eq(intakeRateLimits.key, key))
    .limit(1);

  const existing = rows[0];
  if (!existing || existing.reset_at <= now) {
    await db
      .insert(intakeRateLimits)
      .values({ key, count: 1, reset_at: resetAt })
      .onConflictDoUpdate({
        target: intakeRateLimits.key,
        set: { count: 1, reset_at: resetAt },
      });
    return true;
  }

  if (existing.count >= limit) return false;

  await db
    .update(intakeRateLimits)
    .set({ count: sql`${intakeRateLimits.count} + 1` })
    .where(eq(intakeRateLimits.key, key));
  return true;
}

/** Client IP for rate limiting (first x-forwarded-for hop). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
