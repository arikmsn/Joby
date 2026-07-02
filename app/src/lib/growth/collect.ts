// ============================================================
// Growth Engine — Stage 1 collectors (NO AI).
// Collected items land as raw observations in the human review
// queue: role_family='other', region_code='other', needs_review=true,
// raw_text under the 30-day TTL. Humans structure them via the queue —
// this builds the labeled baseline that Stage-2 extraction must beat.
//
// Dedup: content-hash based (sha256 of channel + normalized text) so
// re-runs and unchanged pages never create duplicate queue rows; the
// unique index on source_jobs.dedup_hash enforces it at insert time.
//
// Relevance: per-source interest config (source-config.ts) — exclude
// keywords are a hard gate, include keywords are hard only when the
// source sets hard_keyword_filter, everything else is priority scoring.
// Sources with no configured keywords fall back to the global
// GROWTH_COLLECTOR_KEYWORDS gate (telegram/gov only).
// ============================================================

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { sourceJobs } from "@/lib/schema";
import {
  GROWTH_COLLECTOR_KEYWORDS,
  RAW_TEXT_TTL_DAYS,
  SourceChannelType,
} from "@/lib/constants";
import { guardedFetchText, htmlToText, FetchGuardError } from "./fetcher";
import {
  SourceConfig,
  parseSourceConfig,
  applyInterestFilter,
} from "./source-config";
import { crawlSource } from "./crawler";

export interface CollectorChannel {
  id: string;
  type: string;
  name: string;
  url: string | null;
  crawl_enabled?: boolean;
  config?: unknown;
}

export interface ChannelCollectResult {
  channel_id: string;
  fetched: number;
  ingested: number;
  duplicates: number;
  filtered: number;
  pages_crawled?: number;
  urls_discovered?: number;
  error?: string;
}

export function matchesKeywords(text: string): boolean {
  return GROWTH_COLLECTOR_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Relevance decision for one item of text under a source's interest config.
 * Falls back to the global keyword gate when no keywords are configured.
 */
function checkRelevance(
  text: string,
  config: SourceConfig,
  fallbackKeywordGate: boolean
): { passed: boolean; priority: number } {
  const interest = config.interest;
  const hasCustom =
    interest.include_keywords.length > 0 ||
    interest.exclude_keywords.length > 0 ||
    interest.role_families.length > 0 ||
    interest.cities.length > 0;

  if (hasCustom) {
    const res = applyInterestFilter(text, interest);
    return { passed: res.passed, priority: res.priority };
  }
  if (fallbackKeywordGate) {
    return { passed: matchesKeywords(text), priority: 0 };
  }
  return { passed: true, priority: 0 };
}

function contentHash(channelId: string, text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256")
    .update(`raw|${channelId}|${normalized}`, "utf8")
    .digest("hex");
}

function titleFrom(text: string): string {
  const firstLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length >= 3) ?? "פריט שנאסף";
  return firstLine.slice(0, 200);
}

/**
 * Insert one raw item into the review queue. Returns "ingested" or
 * "duplicate" (unique-index conflict on the content hash = already seen).
 */
export async function ingestRawItem(
  channelId: string,
  text: string,
  sourceRef: string | null,
  priority = 0
): Promise<"ingested" | "duplicate"> {
  const trimmed = text.trim();
  const result = await db
    .insert(sourceJobs)
    .values({
      channel_id: channelId,
      observed_at: new Date(),
      role_family: "other", // human classifies in the queue (Stage 1: no AI)
      role_title_norm: titleFrom(trimmed),
      region_code: "other",
      employer_type: "unknown",
      urgency_score: 0,
      priority_score: Math.max(0, Math.min(priority, 100)),
      source_ref: sourceRef,
      raw_text: trimmed.slice(0, 20000),
      raw_text_expires_at: new Date(
        Date.now() + RAW_TEXT_TTL_DAYS * 24 * 60 * 60 * 1000
      ),
      needs_review: true,
      dedup_hash: contentHash(channelId, trimmed),
    })
    .onConflictDoNothing({ target: sourceJobs.dedup_hash })
    .returning({ id: sourceJobs.id });
  return result.length > 0 ? "ingested" : "duplicate";
}

// --- Telegram public channels ---
const TG_MESSAGE_RE =
  /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

async function collectTelegram(
  channel: CollectorChannel,
  config: SourceConfig
): Promise<ChannelCollectResult> {
  const url = channel.url ?? "";
  const host = new URL(url).hostname;
  const { text: html } = await guardedFetchText(url, [host]);

  const candidates: { text: string; priority: number }[] = [];
  let filtered = 0;
  let m: RegExpExecArray | null;
  TG_MESSAGE_RE.lastIndex = 0;
  while ((m = TG_MESSAGE_RE.exec(html)) !== null) {
    const msgText = htmlToText(m[1]);
    if (msgText.length < 30) continue;
    const rel = checkRelevance(msgText, config, true);
    if (rel.passed) candidates.push({ text: msgText, priority: rel.priority });
    else filtered++;
  }

  let ingested = 0;
  let duplicates = 0;
  for (const msg of candidates.slice(-30)) {
    const outcome = await ingestRawItem(channel.id, msg.text, url, msg.priority);
    if (outcome === "ingested") ingested++;
    else duplicates++;
  }
  return {
    channel_id: channel.id,
    fetched: candidates.length,
    ingested,
    duplicates,
    filtered,
  };
}

// --- Government / open data ---
async function collectGov(
  channel: CollectorChannel,
  config: SourceConfig
): Promise<ChannelCollectResult> {
  const url = channel.url ?? "";
  const host = new URL(url).hostname;
  const { text } = await guardedFetchText(url, [host]);

  let records: unknown[] = [];
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) records = json;
    else if (Array.isArray(json?.result?.records)) records = json.result.records; // CKAN
    else if (Array.isArray(json?.records)) records = json.records;
  } catch {
    return {
      channel_id: channel.id,
      fetched: 0,
      ingested: 0,
      duplicates: 0,
      filtered: 0,
      error: "response is not valid JSON",
    };
  }

  let ingested = 0;
  let duplicates = 0;
  let matched = 0;
  let filtered = 0;
  for (const record of records.slice(0, 100)) {
    const asText = Object.entries(record as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v ?? "")}`)
      .join("\n");
    const rel = checkRelevance(asText, config, true);
    if (!rel.passed) {
      filtered++;
      continue;
    }
    matched++;
    const outcome = await ingestRawItem(channel.id, asText, url, rel.priority);
    if (outcome === "ingested") ingested++;
    else duplicates++;
  }
  return { channel_id: channel.id, fetched: matched, ingested, duplicates, filtered };
}

// --- Employer career pages (single page — crawl-disabled path) ---
async function collectCareerPage(
  channel: CollectorChannel,
  config: SourceConfig
): Promise<ChannelCollectResult> {
  const url = channel.url ?? "";
  const host = new URL(url).hostname;
  const { text: html } = await guardedFetchText(url, [host]);
  const pageText = htmlToText(html);

  if (pageText.length < 100) {
    return {
      channel_id: channel.id,
      fetched: 0,
      ingested: 0,
      duplicates: 0,
      filtered: 0,
      error: "page text too short (JS-rendered page?)",
    };
  }

  const rel = checkRelevance(pageText, config, false);
  if (!rel.passed) {
    return { channel_id: channel.id, fetched: 1, ingested: 0, duplicates: 0, filtered: 1 };
  }

  const outcome = await ingestRawItem(channel.id, pageText, url, rel.priority);
  return {
    channel_id: channel.id,
    fetched: 1,
    ingested: outcome === "ingested" ? 1 : 0,
    duplicates: outcome === "duplicate" ? 1 : 0,
    filtered: 0,
  };
}

/** Dispatch one approved channel to its collector (crawler when enabled). */
export async function collectChannel(
  channel: CollectorChannel
): Promise<ChannelCollectResult> {
  if (!channel.url) {
    return {
      channel_id: channel.id,
      fetched: 0,
      ingested: 0,
      duplicates: 0,
      filtered: 0,
      error: "channel has no URL",
    };
  }
  const config = parseSourceConfig(channel.config);
  try {
    // Config-driven crawling for site-type sources
    if (
      channel.crawl_enabled &&
      (channel.type === SourceChannelType.CAREER_PAGE ||
        channel.type === SourceChannelType.OTHER ||
        channel.type === SourceChannelType.AGENCY)
    ) {
      const crawl = await crawlSource(channel, config, { dryRun: false });
      return {
        channel_id: channel.id,
        fetched: crawl.pages_crawled,
        ingested: crawl.ingested,
        duplicates: crawl.duplicates,
        filtered: crawl.filtered_out,
        pages_crawled: crawl.pages_crawled,
        urls_discovered: crawl.urls_discovered,
        error: crawl.error,
      };
    }

    switch (channel.type) {
      case SourceChannelType.TELEGRAM:
        return await collectTelegram(channel, config);
      case SourceChannelType.GOV:
        return await collectGov(channel, config);
      case SourceChannelType.CAREER_PAGE:
        return await collectCareerPage(channel, config);
      default:
        return {
          channel_id: channel.id,
          fetched: 0,
          ingested: 0,
          duplicates: 0,
          filtered: 0,
          error: `type ${channel.type} is not collectable (manual only)`,
        };
    }
  } catch (err) {
    const message =
      err instanceof FetchGuardError
        ? `${err.kind}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    return {
      channel_id: channel.id,
      fetched: 0,
      ingested: 0,
      duplicates: 0,
      filtered: 0,
      error: message,
    };
  }
}
