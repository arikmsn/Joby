#!/usr/bin/env node
// Stage-1 pipeline smoke test (dev only): collector ingest + content-hash
// dedup + SSRF guard + human structuring + rule-based clustering + metrics.
// Creates temp channels/rows, cleans everything up.
// Run: node scripts/smoke-stage1.mjs <admin-user-id>  (dev server on :3000)

import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const sql = neon(get("DATABASE_URL"));
const CRON = get("CRON_SECRET");
const secret = new TextEncoder().encode(get("JWT_SECRET"));
const BASE = "http://localhost:3000";

const adminId = process.argv[2];
if (!adminId) {
  console.error("usage: node scripts/smoke-stage1.mjs <admin-user-id>");
  process.exit(1);
}

let failures = 0;
function assert(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const cronHeaders = { Authorization: `Bearer ${CRON}` };
const runJob = (name) =>
  fetch(`${BASE}/api/admin/growth/jobs/${name}`, { method: "POST", headers: cronHeaders });

// --- setup: approved test channels ---
const [chGood] = await sql(
  `insert into source_channels (type, name, url, collection_method, risk_tier, status)
   values ('career_page', 'SMOKE career page', 'https://example.com/', 'fetch', 'low', 'approved')
   returning id`
);
const [chSsrf] = await sql(
  `insert into source_channels (type, name, url, collection_method, risk_tier, status)
   values ('career_page', 'SMOKE ssrf target', 'https://127.0.0.1/jobs', 'fetch', 'low', 'approved')
   returning id`
);
const [chProposed] = await sql(
  `insert into source_channels (type, name, url, collection_method, risk_tier, status)
   values ('career_page', 'SMOKE unapproved', 'https://example.org/', 'fetch', 'low', 'proposed')
   returning id`
);

await sql(`update users set admin_sub_role='super_admin' where id=$1`, [adminId]);
const token = await new SignJWT({ sub: adminId, role: "admin" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt()
  .setIssuer("joby-shiftmatch").setExpirationTime("15m").sign(secret);
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

try {
  // 1. Cron auth gate
  const noSecret = await fetch(`${BASE}/api/admin/growth/jobs/collect`, { method: "POST" });
  assert("collect without cron secret 401", noSecret.status === 401);

  // 2. Collect run: ingests example.com, blocks 127.0.0.1, skips unapproved
  const run1 = await runJob("collect");
  const run1Body = await run1.json();
  assert("collect run 200", run1.status === 200);
  const goodRes = run1Body.results?.find((r) => r.channel_id === chGood.id);
  const ssrfRes = run1Body.results?.find((r) => r.channel_id === chSsrf.id);
  const propRes = run1Body.results?.find((r) => r.channel_id === chProposed.id);
  assert("career page ingested 1 raw item", goodRes?.ingested === 1, JSON.stringify(goodRes));
  assert("SSRF target blocked (private_ip)", !!ssrfRes?.error && ssrfRes.error.includes("private_ip"), ssrfRes?.error);
  assert("unapproved channel not visited", propRes === undefined);

  const rawRows = await sql(
    `select id, role_family, region_code, needs_review, raw_text is not null as has_raw,
            raw_text_expires_at is not null as has_ttl
     from source_jobs where channel_id=$1`, [chGood.id]);
  assert("raw item lands in review queue", rawRows.length === 1 && rawRows[0].needs_review === true);
  assert("raw item unclassified (role_family=other)", rawRows[0].role_family === "other");
  assert("raw_text stored with TTL", rawRows[0].has_raw && rawRows[0].has_ttl);

  // 3. Dedup: second run ingests nothing new for unchanged page
  const run2 = await runJob("collect");
  const run2Body = await run2.json();
  const goodRes2 = run2Body.results?.find((r) => r.channel_id === chGood.id);
  assert("re-run dedups unchanged page", goodRes2?.ingested === 0 && goodRes2?.duplicates === 1, JSON.stringify(goodRes2));

  // 4. Freshness bookkeeping
  const [chRow] = await sql(
    `select last_collected_at is not null as collected, last_collect_error from source_channels where id=$1`,
    [chSsrf.id]);
  assert("last_collected_at set even on error", chRow.collected === true);
  assert("last_collect_error recorded", (chRow.last_collect_error || "").includes("private_ip"));

  // 5. Human structuring via queue (save-and-resolve path)
  const patch = await fetch(`${BASE}/api/admin/growth/observations/${rawRows[0].id}`, {
    method: "PATCH", headers: auth,
    body: JSON.stringify({
      role_family: "warehouse_worker", region_code: "shfela_ashdod",
      role_title_norm: "מחסנאי — פריט איסוף", city: "אשדוד",
      employer_name_public: "SMOKE Employer A",
      salary_min: 45, salary_max: 55, salary_unit: "hourly",
      resolve_review: true,
    }),
  });
  assert("classify + resolve 200", patch.status === 200);

  // 6. Seed structured observations to cross the ad-worthy threshold
  //    (5 obs / 3 distinct employers, same family×region×band)
  for (let i = 0; i < 4; i++) {
    await sql(
      `insert into source_jobs (channel_id, observed_at, role_family, role_title_norm,
         region_code, city, employer_name_public, employer_type, salary_min, salary_max,
         salary_unit, urgency_score, needs_review, dedup_hash)
       values ($1, now() - interval '1 day' * $2, 'warehouse_worker', $3,
         'shfela_ashdod', 'אשדוד', $4, 'direct', 45, 55, 'hourly', 3, false, $5)`,
      [chGood.id, i, `מחסנאי משמרת ${i}`, `SMOKE Employer ${["A", "B", "B", "C"][i]}`,
       `smoke-seed-${i}-${Date.now()}`]
    );
  }

  // 7. Cluster job
  const clusterRun = await runJob("cluster");
  const clusterBody = await clusterRun.json();
  assert("cluster run 200", clusterRun.status === 200);
  const clusters = await sql(
    `select id, observation_count, distinct_employer_count, ad_worthy, salary_band
     from demand_clusters
     where role_family='warehouse_worker' and region_code='shfela_ashdod'`);
  assert("cluster created for family×region", clusters.length >= 1);
  const cluster = clusters.find((c) => c.salary_band === "h_50_60" || c.observation_count >= 5) ?? clusters[0];
  assert("cluster counts observations ≥5", cluster.observation_count >= 5, `got ${cluster.observation_count}`);
  assert("distinct employers = 3", cluster.distinct_employer_count === 3, `got ${cluster.distinct_employer_count}`);
  assert("ad_worthy = true (5 obs ∧ 3 employers)", cluster.ad_worthy === true);
  const assigned = await sql(
    `select count(*)::int as n from source_jobs where cluster_id=$1`, [cluster.id]);
  assert("cluster_id assigned to member rows", assigned[0].n >= 5, `got ${assigned[0].n}`);

  // 8. Metrics endpoint (aggregates incl. median review time)
  const metrics = await fetch(`${BASE}/api/admin/growth/metrics`, { headers: auth });
  const m = (await metrics.json()).data;
  assert("metrics 200", metrics.status === 200);
  assert("median review time present and non-negative",
    m.review_time.median_seconds != null && m.review_time.median_seconds >= 0 && m.review_time.resolved_7d >= 1,
    `median=${m.review_time.median_seconds}s over ${m.review_time.resolved_7d}`);
  assert("freshness computed", m.freshness.percent != null, `${m.freshness.percent}%`);
  assert("ad-worthy cluster visible in metrics", m.clusters.ad_worthy >= 1);
  assert("metrics payload has no PII keys",
    !JSON.stringify(m).match(/"(phone|email|full_name|cv_file_ref)"/));

  // 9. Analyst cannot run cron jobs with a user token
  const userTokenJob = await fetch(`${BASE}/api/admin/growth/jobs/collect`, {
    method: "POST", headers: auth });
  assert("user JWT cannot trigger cron job", userTokenJob.status === 401);
} finally {
  await sql(`delete from source_jobs where channel_id in ($1,$2,$3)`, [chGood.id, chSsrf.id, chProposed.id]);
  await sql(`delete from demand_clusters where role_family='warehouse_worker' and region_code='shfela_ashdod'
             and observation_count >= 0 and id not in (select distinct cluster_id from source_jobs where cluster_id is not null)`);
  await sql(`delete from source_channels where name like 'SMOKE%'`);
  await sql(`update users set admin_sub_role=null where id=$1`, [adminId]);
  console.log("🧹 cleaned up: channels, observations, clusters, sub-role");
}

console.log(failures === 0 ? "\n✅ stage-1 smoke test passed" : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
