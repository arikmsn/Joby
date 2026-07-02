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

export interface CollectorChannel {
  id: string;
  type: string;
  name: string;
  url: string | null;
}

export interface ChannelCollectResult {
  channel_id: string;
  fetched: number;
  ingested: number;
  duplicates: number;
  error?: string;
}

export function matchesKeywords(text: string): boolean {
  return GROWTH_COLLECTOR_KEYWORDS.some((kw) => text.includes(kw));
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
  sourceRef: string | null
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
// Reads the public web preview (t.me/s/<name>) of an APPROVED channel and
// extracts message texts. Keyword-filtered to control queue noise.
const TG_MESSAGE_RE =
  /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

async function collectTelegram(
  channel: CollectorChannel
): Promise<ChannelCollectResult> {
  const url = channel.url ?? "";
  const host = new URL(url).hostname;
  const { text: html } = await guardedFetchText(url, [host]);

  const messages: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = TG_MESSAGE_RE.exec(html)) !== null) {
    const msgText = htmlToText(m[1]);
    if (msgText.length >= 30 && matchesKeywords(msgText)) messages.push(msgText);
  }

  let ingested = 0;
  let duplicates = 0;
  for (const msg of messages.slice(-30)) {
    const outcome = await ingestRawItem(channel.id, msg, url);
    if (outcome === "ingested") ingested++;
    else duplicates++;
  }
  return { channel_id: channel.id, fetched: messages.length, ingested, duplicates };
}

// --- Government / open data ---
// Channel URL points at a JSON endpoint (e.g., a data.gov.il CKAN
// datastore_search URL, configured per channel by ops). Each record
// becomes one keyword-filtered raw item.
async function collectGov(
  channel: CollectorChannel
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
      error: "response is not valid JSON",
    };
  }

  let ingested = 0;
  let duplicates = 0;
  let matched = 0;
  for (const record of records.slice(0, 100)) {
    const asText = Object.entries(record as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v ?? "")}`)
      .join("\n");
    if (!matchesKeywords(asText)) continue;
    matched++;
    const outcome = await ingestRawItem(channel.id, asText, url);
    if (outcome === "ingested") ingested++;
    else duplicates++;
  }
  return { channel_id: channel.id, fetched: matched, ingested, duplicates };
}

// --- Employer career pages ---
// Curated per-employer pages: fetch, strip to text, ingest the page as one
// raw item. Content-hash dedup means unchanged pages produce nothing new.
async function collectCareerPage(
  channel: CollectorChannel
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
      error: "page text too short (JS-rendered page?)",
    };
  }

  const outcome = await ingestRawItem(channel.id, pageText, url);
  return {
    channel_id: channel.id,
    fetched: 1,
    ingested: outcome === "ingested" ? 1 : 0,
    duplicates: outcome === "duplicate" ? 1 : 0,
  };
}

/** Dispatch one approved channel to its per-type collector. */
export async function collectChannel(
  channel: CollectorChannel
): Promise<ChannelCollectResult> {
  if (!channel.url) {
    return {
      channel_id: channel.id,
      fetched: 0,
      ingested: 0,
      duplicates: 0,
      error: "channel has no URL",
    };
  }
  try {
    switch (channel.type) {
      case SourceChannelType.TELEGRAM:
        return await collectTelegram(channel);
      case SourceChannelType.GOV:
        return await collectGov(channel);
      case SourceChannelType.CAREER_PAGE:
        return await collectCareerPage(channel);
      default:
        return {
          channel_id: channel.id,
          fetched: 0,
          ingested: 0,
          duplicates: 0,
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
    return { channel_id: channel.id, fetched: 0, ingested: 0, duplicates: 0, error: message };
  }
}
