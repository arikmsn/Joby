// ============================================================
// Growth Engine — rule-based clustering helpers (Stage 1, NO AI).
// Cluster = role_family × region_code × salary_band over structured
// observations (human-reviewed, classified ≠ 'other').
// ad_worthy rule (spec §7, anti-mirroring): ≥5 observations from
// ≥3 distinct named employers — computed here and by the job ONLY,
// never writable via any API.
// ============================================================

export const AD_WORTHY_MIN_OBSERVATIONS = 5;
export const AD_WORTHY_MIN_EMPLOYERS = 3;

/** Salary band key from an observation's salary fields. */
export function salaryBand(
  min: string | number | null,
  max: string | number | null,
  unit: string | null
): string {
  const lo = min != null ? Number(min) : null;
  const hi = max != null ? Number(max) : null;
  const mid =
    lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi);
  if (mid == null || Number.isNaN(mid)) return "unknown";

  if (unit === "monthly") {
    if (mid < 7000) return "m_lt7000";
    if (mid < 9000) return "m_7000_9000";
    if (mid < 12000) return "m_9000_12000";
    return "m_gte12000";
  }
  // default: hourly
  if (mid < 40) return "h_lt40";
  if (mid < 50) return "h_40_50";
  if (mid < 60) return "h_50_60";
  return "h_gte60";
}

/** Trend from last-7-days vs prior-7-days observation counts. */
export function computeTrend(last7: number, prior7: number): string {
  if (prior7 === 0) return last7 > 0 ? "rising" : "stable";
  const ratio = last7 / prior7;
  if (ratio >= 1.25) return "rising";
  if (ratio <= 0.75) return "falling";
  return "stable";
}

export interface ObservationForClustering {
  id: string;
  role_family: string;
  region_code: string;
  salary_min: string | null;
  salary_max: string | null;
  salary_unit: string | null;
  employer_name_public: string | null;
  observed_at: Date;
}

export interface ClusterAggregate {
  key: string;
  role_family: string;
  region_code: string;
  salary_band: string;
  observation_ids: string[];
  observation_count: number;
  distinct_employer_count: number;
  first_seen: Date;
  last_seen: Date;
  last7: number;
  prior7: number;
  ad_worthy: boolean;
}

/** Group structured observations into cluster aggregates (pure function). */
export function aggregateClusters(
  rows: ObservationForClustering[],
  now: Date = new Date()
): ClusterAggregate[] {
  const groups = new Map<string, ObservationForClustering[]>();
  for (const row of rows) {
    const band = salaryBand(row.salary_min, row.salary_max, row.salary_unit);
    const key = `${row.role_family}|${row.region_code}|${band}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const d7 = 7 * 24 * 60 * 60 * 1000;
  const aggregates: ClusterAggregate[] = [];
  for (const [key, members] of Array.from(groups.entries())) {
    const [role_family, region_code, salary_band_key] = key.split("|");
    const employers = new Set(
      members
        .map((m) => m.employer_name_public?.trim().toLowerCase())
        .filter((name): name is string => !!name)
    );
    const times = members.map((m) => m.observed_at.getTime());
    const last7 = members.filter(
      (m) => now.getTime() - m.observed_at.getTime() <= d7
    ).length;
    const prior7 = members.filter((m) => {
      const age = now.getTime() - m.observed_at.getTime();
      return age > d7 && age <= 2 * d7;
    }).length;

    aggregates.push({
      key,
      role_family,
      region_code,
      salary_band: salary_band_key,
      observation_ids: members.map((m) => m.id),
      observation_count: members.length,
      distinct_employer_count: employers.size,
      first_seen: new Date(Math.min(...times)),
      last_seen: new Date(Math.max(...times)),
      last7,
      prior7,
      ad_worthy:
        members.length >= AD_WORTHY_MIN_OBSERVATIONS &&
        employers.size >= AD_WORTHY_MIN_EMPLOYERS,
    });
  }
  return aggregates;
}
