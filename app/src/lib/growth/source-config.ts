// ============================================================
// Growth Engine — per-source crawl configuration (Stage 1f).
// "Configuration over code": ops manages crawling behavior from
// the admin UI; `source_channels.config` is ALWAYS parsed through
// sourceConfigSchema before use — never trusted raw.
// ============================================================

import { z } from "zod";
import { ROLE_FAMILIES, GROWTH_REGIONS, ObservedEmployerType } from "@/lib/constants";

const roleFamilyKeys = ROLE_FAMILIES.map((r) => r.key) as [string, ...string[]];
const regionKeys = GROWTH_REGIONS.map((r) => r.key) as [string, ...string[]];

const urlRule = z.string().min(1).max(200);

export const interestConfigSchema = z.object({
  // scoring signals (see scorePriority); exclude_keywords are always a hard gate
  role_families: z.array(z.enum(roleFamilyKeys)).max(20).default([]),
  include_keywords: z.array(z.string().min(1).max(60)).max(50).default([]),
  exclude_keywords: z.array(z.string().min(1).max(60)).max(50).default([]),
  regions: z.array(z.enum(regionKeys)).max(10).default([]),
  cities: z.array(z.string().min(1).max(60)).max(30).default([]),
  // advisory in Stage 1 (raw pages can't be typed pre-structuring)
  employer_type: z.nativeEnum(ObservedEmployerType).optional().nullable(),
  // true → include_keywords become a hard filter (must match ≥1)
  hard_keyword_filter: z.boolean().default(false),
});

export const scheduleConfigSchema = z.object({
  frequency_hours: z.number().int().min(1).max(168).default(12),
  // preferred local-hours window (inclusive start, exclusive end; start===end → always)
  window_start_hour: z.number().int().min(0).max(23).default(5),
  window_end_hour: z.number().int().min(0).max(23).default(22),
  max_runtime_ms: z.number().int().min(10_000).max(240_000).default(120_000),
  // consecutive failed runs before crawling is auto-disabled (audited)
  max_retries: z.number().int().min(0).max(10).default(3),
});

export const sourceConfigSchema = z.object({
  seed_urls: z.array(z.string().url().max(2000)).max(20).default([]),
  max_depth: z.number().int().min(0).max(5).default(2),
  same_domain_only: z.boolean().default(true),
  max_pages_per_run: z.number().int().min(1).max(200).default(30),
  // polite-fetch guardrail: never below 2s between requests to the same host
  crawl_delay_ms: z.number().int().min(2000).max(60_000).default(10_000),
  stale_threshold_hours: z.number().int().min(6).max(168).default(48),
  include_rules: z.array(urlRule).max(50).default([]),
  exclude_rules: z.array(urlRule).max(50).default([]),
  interest: interestConfigSchema.default({}),
  schedule: scheduleConfigSchema.default({}),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

/** Parse a channel's raw config jsonb; invalid/missing → validated defaults. */
export function parseSourceConfig(raw: unknown): SourceConfig {
  const parsed = sourceConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : sourceConfigSchema.parse({});
}

// --- URL rule matching -----------------------------------------------------
// Rules are simple wildcard patterns matched (case-insensitive) against
// `pathname + search`, e.g. "/careers/*", "*jobs*", "*/login*", "*?page=*".
// A rule with no wildcard matches as a substring.

function ruleToRegex(rule: string): RegExp {
  const escaped = rule
    .toLowerCase()
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const hasWildcard = rule.includes("*");
  return new RegExp(hasWildcard ? `^${escaped}$` : escaped);
}

function pathOf(url: URL): string {
  return (url.pathname + url.search).toLowerCase();
}

export type UrlVerdict =
  | "allowed"
  | "blocked_exclude"
  | "blocked_include"
  | "blocked_domain";

/**
 * Classify a URL against the source's rules.
 * - exclude rules always win — seeds included (explicit requirement)
 * - include rules apply only to DISCOVERED urls; seeds bypass them
 * - host must be in `allowedHosts` (root + seed hosts)
 */
export function classifyUrl(
  url: URL,
  config: SourceConfig,
  allowedHosts: Set<string>,
  isSeed: boolean
): UrlVerdict {
  if (!allowedHosts.has(url.hostname.toLowerCase())) return "blocked_domain";
  const path = pathOf(url);
  for (const rule of config.exclude_rules) {
    if (ruleToRegex(rule).test(path)) return "blocked_exclude";
  }
  if (!isSeed && config.include_rules.length > 0) {
    const included = config.include_rules.some((rule) =>
      ruleToRegex(rule).test(path)
    );
    if (!included) return "blocked_include";
  }
  return "allowed";
}

/** Strip tracking/query noise and fragments so dedup and rules see stable URLs. */
export function normalizeUrl(raw: string, base: URL): URL | null {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.hash = "";
  const noise = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ref", "sessionid", "phpsessid"];
  for (const key of noise) url.searchParams.delete(key);
  // stable param order
  url.searchParams.sort();
  return url;
}

// --- Interest filtering ------------------------------------------------------

const familyLabelByKey = new Map<string, string>(
  ROLE_FAMILIES.map((r) => [r.key, r.label_he])
);

export interface InterestResult {
  passed: boolean;
  reason?: "exclude_keyword" | "missing_include_keyword";
  priority: number; // 0-100
}

/**
 * Apply interest filters to extracted page/message text.
 * Hard gates: any exclude keyword; missing include keyword when
 * hard_keyword_filter is on. Everything else is priority scoring.
 */
export function applyInterestFilter(
  text: string,
  interest: SourceConfig["interest"]
): InterestResult {
  const haystack = text.toLowerCase();

  for (const kw of interest.exclude_keywords) {
    if (haystack.includes(kw.toLowerCase())) {
      return { passed: false, reason: "exclude_keyword", priority: 0 };
    }
  }

  const includeHits = interest.include_keywords.filter((kw) =>
    haystack.includes(kw.toLowerCase())
  ).length;

  if (
    interest.hard_keyword_filter &&
    interest.include_keywords.length > 0 &&
    includeHits === 0
  ) {
    return { passed: false, reason: "missing_include_keyword", priority: 0 };
  }

  let priority = 0;
  priority += Math.min(includeHits * 10, 40);
  const familyHits = interest.role_families.filter((key) => {
    const label = familyLabelByKey.get(key);
    return label ? haystack.includes(label.toLowerCase()) : false;
  }).length;
  priority += Math.min(familyHits * 15, 45);
  const cityHits = interest.cities.filter((c) =>
    haystack.includes(c.toLowerCase())
  ).length;
  priority += Math.min(cityHits * 5, 15);

  return { passed: true, priority: Math.min(priority, 100) };
}

/** Is the current hour inside the source's preferred window? start===end → always. */
export function isWithinWindow(
  schedule: SourceConfig["schedule"],
  now: Date = new Date()
): boolean {
  const { window_start_hour: start, window_end_hour: end } = schedule;
  if (start === end) return true;
  const hour = now.getHours();
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
