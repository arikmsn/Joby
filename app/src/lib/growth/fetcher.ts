// ============================================================
// Growth Engine — SSRF-guarded fetch core for collectors.
// Rules (execution pack §8):
// - fetch ONLY hosts belonging to approved source channels (per-call allowlist)
// - https only; block private/link-local/loopback IPs after DNS resolution
// - refuse redirects that leave the allowlisted host; max 3 hops
// - response size cap; timeout; polite per-domain spacing is the caller's job
// - abort on 403/CAPTCHA-ish responses and report (never retry aggressively)
// ============================================================

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15000;
const MAX_BYTES = 500_000; // hard read cap

export class FetchGuardError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "protocol"
      | "host_not_allowed"
      | "private_ip"
      | "redirect"
      | "blocked"
      | "too_large"
      | "timeout"
      | "http_error"
  ) {
    super(message);
  }
}

function isPrivateIp(addr: string): boolean {
  if (isIP(addr) === 4) {
    const [a, b] = addr.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = addr.toLowerCase();
  return (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("::ffff:127.") ||
    lower.startsWith("::ffff:10.") ||
    lower.startsWith("::ffff:192.168.")
  );
}

async function assertResolvesPublic(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new FetchGuardError(`private IP literal: ${hostname}`, "private_ip");
    }
    return;
  }
  const addrs = await lookup(hostname, { all: true });
  if (addrs.length === 0) {
    throw new FetchGuardError(`no DNS records for ${hostname}`, "private_ip");
  }
  for (const { address } of addrs) {
    if (isPrivateIp(address)) {
      throw new FetchGuardError(
        `${hostname} resolves to private address`,
        "private_ip"
      );
    }
  }
}

/**
 * Fetch a URL with SSRF guards. `allowedHosts` is the per-call allowlist —
 * normally exactly the approved channel's host. Returns body text
 * (truncated to MAX_BYTES) and the final status.
 */
export async function guardedFetchText(
  url: string,
  allowedHosts: string[]
): Promise<{ status: number; text: string }> {
  let current = new URL(url);
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "https:") {
      throw new FetchGuardError(`non-https URL: ${current}`, "protocol");
    }
    if (!allowed.has(current.hostname.toLowerCase())) {
      throw new FetchGuardError(
        `host not on allowlist: ${current.hostname}`,
        "host_not_allowed"
      );
    }
    await assertResolvesPublic(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "user-agent": "JobyGrowthCollector/1.0 (+contact via site)",
          accept: "text/html,application/json;q=0.9,*/*;q=0.5",
        },
      });
    } catch (err) {
      throw new FetchGuardError(
        err instanceof Error && err.name === "AbortError"
          ? `timeout after ${TIMEOUT_MS}ms`
          : `fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
        "timeout"
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new FetchGuardError("redirect without location", "redirect");
      const next = new URL(loc, current);
      if (!allowed.has(next.hostname.toLowerCase())) {
        throw new FetchGuardError(
          `redirect off allowlist: ${next.hostname}`,
          "redirect"
        );
      }
      current = next;
      continue;
    }

    if (res.status === 403 || res.status === 429 || res.status === 401) {
      // Abort-and-report rule: the source is pushing back — never fight it
      throw new FetchGuardError(`blocked with HTTP ${res.status}`, "blocked");
    }
    if (!res.ok) {
      throw new FetchGuardError(`HTTP ${res.status}`, "http_error");
    }

    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, text: "" };
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { status: res.status, text: buf.toString("utf8") };
  }

  throw new FetchGuardError("too many redirects", "redirect");
}

/** Strip tags/scripts and collapse whitespace — for career-page HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
