#!/usr/bin/env node
// Stage-1f crawler smoke test (dev only): config PATCH, dry-run test mode,
// include/exclude rules (seeds respect exclude), interest hard-filter,
// run-now with run history, scheduling window, system-jobs authz.
// Uses example.com (stable, few links) as the crawl target.
// Run: node scripts/smoke-crawler.mjs <admin-user-id>  (dev server on :3000)

import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const sql = neon(get("DATABASE_URL"));
const secret = new TextEncoder().encode(get("JWT_SECRET"));
const BASE = "http://localhost:3000";

const adminId = process.argv[2];
if (!adminId) {
  console.error("usage: node scripts/smoke-crawler.mjs <admin-user-id>");
  process.exit(1);
}

let failures = 0;
function assert(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

await sql(`update users set admin_sub_role='super_admin' where id=$1`, [adminId]);
const token = await new SignJWT({ sub: adminId, role: "admin" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt()
  .setIssuer("joby-shiftmatch").setExpirationTime("15m").sign(secret);
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const [ch] = await sql(
  `insert into source_channels (type, name, url, collection_method, risk_tier, status, crawl_enabled)
   values ('career_page', 'SMOKE crawler', 'https://example.com/', 'fetch', 'low', 'approved', true)
   returning id`
);

try {
  // 1. GET detail returns validated default config
  const detail = await (await fetch(`${BASE}/api/admin/growth/sources/${ch.id}`, { headers: auth })).json();
  assert("GET detail 200 with config", !!detail.data?.config, JSON.stringify(detail.error || "").slice(0, 60));
  assert("config has schema defaults", detail.data.config.max_depth === 2 && detail.data.config.crawl_delay_ms >= 2000);

  // 2. PATCH config: depth 0 (root only), no interest filter
  const patch = await fetch(`${BASE}/api/admin/growth/sources/${ch.id}`, {
    method: "PATCH", headers: auth,
    body: JSON.stringify({
      crawl_enabled: true,
      config: {
        seed_urls: [], max_depth: 0, same_domain_only: true,
        max_pages_per_run: 5, crawl_delay_ms: 2000, stale_threshold_hours: 48,
        include_rules: [], exclude_rules: [],
        interest: { role_families: [], include_keywords: [], exclude_keywords: [],
          regions: [], cities: [], hard_keyword_filter: false },
        schedule: { frequency_hours: 12, window_start_hour: 0, window_end_hour: 0,
          max_runtime_ms: 60000, max_retries: 3 },
      },
    }),
  });
  assert("PATCH config 200", patch.status === 200);

  // 3. Invalid config rejected (crawl_delay below 2000 floor)
  const badPatch = await fetch(`${BASE}/api/admin/growth/sources/${ch.id}`, {
    method: "PATCH", headers: auth,
    body: JSON.stringify({ config: { crawl_delay_ms: 100 } }),
  });
  assert("invalid config (delay<2000) 400", badPatch.status === 400);

  // 4. Dry-run test: nothing persisted, returns summary + sample
  const before = (await sql(`select count(*)::int as n from source_jobs where channel_id=$1`, [ch.id]))[0].n;
  const test = await (await fetch(`${BASE}/api/admin/growth/sources/${ch.id}/test`, {
    method: "POST", headers: auth, body: JSON.stringify({}) })).json();
  assert("test returns summary", !!test.data?.summary, JSON.stringify(test.error || "").slice(0, 60));
  assert("test crawled root page", test.data.summary.crawled >= 1);
  assert("test produced a text sample", Array.isArray(test.data.samples) && test.data.samples.length >= 1);
  const afterTest = (await sql(`select count(*)::int as n from source_jobs where channel_id=$1`, [ch.id]))[0].n;
  assert("dry-run persisted nothing", afterTest === before);

  // 5. Exclude rule applies to seed/root URL too
  const testExclude = await (await fetch(`${BASE}/api/admin/growth/sources/${ch.id}/test`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ config: {
      seed_urls: [], max_depth: 0, same_domain_only: true, max_pages_per_run: 5,
      crawl_delay_ms: 2000, stale_threshold_hours: 48,
      include_rules: [], exclude_rules: ["*"],  // exclude everything, incl. root
      interest: { role_families: [], include_keywords: [], exclude_keywords: [],
        regions: [], cities: [], hard_keyword_filter: false },
      schedule: { frequency_hours: 12, window_start_hour: 0, window_end_hour: 0,
        max_runtime_ms: 60000, max_retries: 3 },
    } }) })).json();
  assert("exclude '*' blocks even the root/seed", testExclude.data.summary.crawled === 0 && testExclude.data.summary.blocked >= 1);

  // 6. Interest hard-filter drops non-matching page
  const testFilter = await (await fetch(`${BASE}/api/admin/growth/sources/${ch.id}/test`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ config: {
      seed_urls: [], max_depth: 0, same_domain_only: true, max_pages_per_run: 5,
      crawl_delay_ms: 2000, stale_threshold_hours: 48, include_rules: [], exclude_rules: [],
      interest: { role_families: [], include_keywords: ["דרושים_לא_קיים_בעמוד"],
        exclude_keywords: [], regions: [], cities: [], hard_keyword_filter: true },
      schedule: { frequency_hours: 12, window_start_hour: 0, window_end_hour: 0,
        max_runtime_ms: 60000, max_retries: 3 },
    } }) })).json();
  assert("hard include-filter filters non-matching page", testFilter.data.summary.filtered_out >= 1 && testFilter.data.summary.ingestable === 0);

  // 7. Run now: persists + writes a run row
  const run = await (await fetch(`${BASE}/api/admin/growth/sources/${ch.id}/run`, {
    method: "POST", headers: auth })).json();
  assert("run now returns ingested count", typeof run.ingested === "number");
  const runs = await (await fetch(`${BASE}/api/admin/growth/sources/${ch.id}/runs`, { headers: auth })).json();
  assert("run history has a manual run", (runs.data || []).some((r) => r.trigger === "manual"));
  const [chAfter] = await sql(`select last_collected_at, next_run_at from source_channels where id=$1`, [ch.id]);
  assert("last_collected_at + next_run_at set", !!chAfter.last_collected_at && !!chAfter.next_run_at);

  // 8. Scheduling: set window to a non-current hour → not due in scheduled collect
  const hour = new Date().getHours();
  const offStart = (hour + 2) % 24, offEnd = (hour + 3) % 24;
  await sql(`update source_channels set next_run_at = now() - interval '1 hour', config = jsonb_set(config, '{schedule,window_start_hour}', $2::text::jsonb) where id=$1`, [ch.id, String(offStart)]);
  await sql(`update source_channels set config = jsonb_set(config, '{schedule,window_end_hour}', $2::text::jsonb) where id=$1`, [ch.id, String(offEnd)]);
  const sysCollect = await (await fetch(`${BASE}/api/admin/growth/system-jobs`, {
    method: "POST", headers: auth, body: JSON.stringify({ job: "collect" }) })).json();
  const ranThis = (sysCollect.results || []).some((r) => r.channel_id === ch.id);
  assert("channel outside its window is skipped by scheduled collect", !ranThis);

  // 9. system-jobs authz: analyst denied
  await sql(`update users set admin_sub_role='growth_analyst' where id=$1`, [adminId]);
  const analystToken = await new SignJWT({ sub: adminId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setIssuer("joby-shiftmatch").setExpirationTime("15m").sign(secret);
  const denied = await fetch(`${BASE}/api/admin/growth/system-jobs`, {
    method: "POST", headers: { Authorization: `Bearer ${analystToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ job: "purge" }) });
  assert("analyst cannot run system jobs (403)", denied.status === 403);
} finally {
  await sql(`delete from source_jobs where channel_id=$1`, [ch.id]);
  await sql(`delete from collector_runs where channel_id=$1`, [ch.id]);
  await sql(`delete from source_channels where id=$1`, [ch.id]);
  await sql(`update users set admin_sub_role=null where id=$1`, [adminId]);
  console.log("🧹 cleaned up: channel, observations, runs, sub-role");
}

console.log(failures === 0 ? "\n✅ crawler smoke test passed" : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
