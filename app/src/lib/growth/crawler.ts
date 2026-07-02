// ============================================================
// Growth Engine — config-driven crawler (Stage 1f, NO AI).
// BFS from root + seed URLs, bounded by the source's config
// (depth, pages, delay, rules). All fetches go through the
// SSRF-guarded core; the host allowlist is ONLY root + seed
// hosts — discovered off-allowlist hosts are never fetched,
// even when same_domain_only is off. robots.txt Disallow rules
// (UA *) are honored. Seeds bypass include rules but NEVER
// exclude rules. Dry-run mode reports without ingesting.
// ============================================================

import { guardedFetchText, htmlToText, FetchGuardError } from "./fetcher";
import {
  SourceConfig,
  classifyUrl,
  normalizeUrl,
  applyInterestFilter,
  UrlVerdict,
} from "./source-config";
import { ingestRawItem } from "./collect";

export interface CrawlUrlReport {
  url: string;
  depth: number;
  verdict: UrlVerdict | "blocked_robots" | "fetch_error";
  detail?: string;
}

export interface CrawlPageReport {
  url: string;
  outcome: "ingested" | "duplicate" | "filtered";
  filter_reason?: string;
  priority: number;
  sample?: string; // dry-run only — never persisted
}

export interface CrawlResult {
  urls: CrawlUrlReport[];
  pages: CrawlPageReport[];
  pages_crawled: number;
  urls_discovered: number;
  ingested: number;
  duplicates: number;
  filtered_out: number;
  stopped_reason: "done" | "max_pages" | "max_runtime";
  error?: string;
}

const HREF_RE = /href\s*=\s*["']([^"'#][^"']*)["']/gi;
const MIN_PAGE_TEXT = 80;
const DRY_RUN_MAX_PAGES = 15;
const DRY_RUN_SAMPLE_CHARS = 600;

// --- Minimal robots.txt support (User-agent: * group, Disallow prefixes) ---
async function fetchRobotsDisallows(
  origin: string,
  host: string
): Promise<string[]> {
  try {
    const { text } = await guardedFetchText(`${origin}/robots.txt`, [host]);
    const lines = text.split("\n").map((l) => l.trim());
    const disallows: string[] = [];
    let applies = false;
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey?.toLowerCase().trim();
      const value = rest.join(":").split("#")[0].trim();
      if (key === "user-agent") {
        applies = value === "*";
      } else if (applies && key === "disallow" && value.length > 0) {
        disallows.push(value);
      }
    }
    return disallows;
  } catch {
    return []; // no/unreachable robots.txt → allowed
  }
}

function robotsBlocked(url: URL, disallowsByHost: Map<string, string[]>): boolean {
  const disallows = disallowsByHost.get(url.hostname.toLowerCase()) ?? [];
  const path = url.pathname + url.search;
  return disallows.some((prefix) => path.startsWith(prefix));
}

function extractLinks(html: string, base: URL): URL[] {
  const links: URL[] = [];
  let m: RegExpExecArray | null;
  HREF_RE.lastIndex = 0;
  while ((m = HREF_RE.exec(html)) !== null) {
    const normalized = normalizeUrl(m[1], base);
    if (normalized) links.push(normalized);
  }
  return links;
}

export async function crawlSource(
  channel: { id: string; url: string | null },
  config: SourceConfig,
  options: { dryRun: boolean; startedAt?: number }
): Promise<CrawlResult> {
  const result: CrawlResult = {
    urls: [],
    pages: [],
    pages_crawled: 0,
    urls_discovered: 0,
    ingested: 0,
    duplicates: 0,
    filtered_out: 0,
    stopped_reason: "done",
  };

  const rootUrl = channel.url ? normalizeUrl(channel.url, new URL(channel.url)) : null;
  const seedUrls = config.seed_urls
    .map((s) => {
      try {
        return normalizeUrl(s, new URL(s));
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => !!u);

  const seeds = [rootUrl, ...seedUrls].filter((u): u is URL => !!u);
  if (seeds.length === 0) {
    result.error = "no root/seed URLs configured";
    return result;
  }

  // Host allowlist: root + seed hosts ONLY (SSRF posture — discovered hosts
  // are never fetched). same_domain_only additionally restricts to root host.
  const rootHost = seeds[0].hostname.toLowerCase();
  const allowedHosts = new Set<string>(
    config.same_domain_only
      ? [rootHost]
      : seeds.map((u) => u.hostname.toLowerCase())
  );

  const maxPages = options.dryRun
    ? Math.min(config.max_pages_per_run, DRY_RUN_MAX_PAGES)
    : config.max_pages_per_run;
  const startedAt = options.startedAt ?? Date.now();
  const deadline = startedAt + config.schedule.max_runtime_ms;

  // robots.txt per allowed host, fetched once
  const disallowsByHost = new Map<string, string[]>();
  for (const host of Array.from(allowedHosts)) {
    disallowsByHost.set(host, await fetchRobotsDisallows(`https://${host}`, host));
  }

  const visited = new Set<string>();
  const queue: { url: URL; depth: number; isSeed: boolean }[] = seeds.map(
    (url) => ({ url, depth: 0, isSeed: true })
  );
  const seenKeys = new Set(queue.map((q) => q.url.toString()));
  const lastFetchByHost = new Map<string, number>();

  while (queue.length > 0) {
    if (result.pages_crawled >= maxPages) {
      result.stopped_reason = "max_pages";
      break;
    }
    if (Date.now() >= deadline) {
      result.stopped_reason = "max_runtime";
      break;
    }

    const { url, depth, isSeed } = queue.shift()!;
    const key = url.toString();
    if (visited.has(key)) continue;
    visited.add(key);

    const verdict = classifyUrl(url, config, allowedHosts, isSeed);
    if (verdict !== "allowed") {
      result.urls.push({ url: key, depth, verdict });
      continue;
    }
    if (robotsBlocked(url, disallowsByHost)) {
      result.urls.push({ url: key, depth, verdict: "blocked_robots" });
      continue;
    }

    // polite spacing per host
    const host = url.hostname.toLowerCase();
    const last = lastFetchByHost.get(host) ?? 0;
    const wait = last + config.crawl_delay_ms - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastFetchByHost.set(host, Date.now());

    let html: string;
    try {
      const res = await guardedFetchText(key, Array.from(allowedHosts));
      html = res.text;
    } catch (err) {
      const detail =
        err instanceof FetchGuardError
          ? `${err.kind}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "unknown";
      result.urls.push({ url: key, depth, verdict: "fetch_error", detail });
      // a blocked (403/429) source aborts the whole run — never fight back
      if (err instanceof FetchGuardError && err.kind === "blocked") {
        result.error = `source pushed back: ${detail}`;
        break;
      }
      continue;
    }

    result.urls.push({ url: key, depth, verdict: "allowed" });
    result.pages_crawled++;

    // page → text → interest filter → ingest (or report in dry-run)
    const text = htmlToText(html);
    if (text.length >= MIN_PAGE_TEXT) {
      const interest = applyInterestFilter(text, config.interest);
      if (!interest.passed) {
        result.filtered_out++;
        result.pages.push({
          url: key,
          outcome: "filtered",
          filter_reason: interest.reason,
          priority: 0,
          ...(options.dryRun
            ? { sample: text.slice(0, DRY_RUN_SAMPLE_CHARS) }
            : {}),
        });
      } else if (options.dryRun) {
        result.pages.push({
          url: key,
          outcome: "ingested",
          priority: interest.priority,
          sample: text.slice(0, DRY_RUN_SAMPLE_CHARS),
        });
        result.ingested++;
      } else {
        const outcome = await ingestRawItem(channel.id, text, key, interest.priority);
        result.pages.push({ url: key, outcome, priority: interest.priority });
        if (outcome === "ingested") result.ingested++;
        else result.duplicates++;
      }
    }

    // discover links
    if (depth < config.max_depth) {
      for (const link of extractLinks(html, url)) {
        const linkKey = link.toString();
        if (seenKeys.has(linkKey) || visited.has(linkKey)) continue;
        seenKeys.add(linkKey);
        result.urls_discovered++;
        queue.push({ url: link, depth: depth + 1, isSeed: false });
      }
    }
  }

  return result;
}
