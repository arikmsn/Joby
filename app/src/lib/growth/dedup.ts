// ============================================================
// Growth Engine — server-side dedup hash for observations.
// Rule (spec §7): same employer+title+city within a 14-day
// window = duplicate. The hash buckets observed_at into 14-day
// windows so the unique index on source_jobs.dedup_hash enforces
// the rule at insert time.
// ============================================================

import { createHash } from "crypto";

export const DEDUP_WINDOW_DAYS = 14;

export function computeDedupHash(input: {
  employer_name_public: string | null | undefined;
  role_title_norm: string;
  city: string | null | undefined;
  region_code: string;
  observed_at: Date;
}): string {
  const windowBucket = Math.floor(
    input.observed_at.getTime() / (DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  );
  const normalized = [
    (input.employer_name_public ?? "").trim().toLowerCase(),
    input.role_title_norm.trim().toLowerCase(),
    (input.city ?? "").trim().toLowerCase(),
    input.region_code,
    String(windowBucket),
  ].join("|");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
