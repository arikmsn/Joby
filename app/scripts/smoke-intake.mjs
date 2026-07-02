#!/usr/bin/env node
// W2 intake smoke test (dev only): public LP gating, hardened intake
// (validation, honeypot, rate limits, silent upsert), masked review queue,
// audited unmask. Creates a temp LP + test rows, cleans everything up.
// Run: node scripts/smoke-intake.mjs <admin-user-id>  (dev server on :3000,
// PUBLIC_LP_ENABLED=true in .env.local)

import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const sql = neon(get("DATABASE_URL"));
const secret = new TextEncoder().encode(get("JWT_SECRET"));
const BASE = "http://localhost:3000";
const TEST_PHONE = "0559990001";

const adminId = process.argv[2];
if (!adminId) {
  console.error("usage: node scripts/smoke-intake.mjs <admin-user-id>");
  process.exit(1);
}

let failures = 0;
function assert(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// --- setup: temp live LP ---
const [lp] = await sql(
  `insert into landing_pages (slug, role_family, region_code, headline_he, status)
   values ('smoke-test-lp', 'warehouse_worker', 'shfela_ashdod', 'בדיקה', 'live')
   returning id`
);

const intakeBody = {
  full_name: "בדיקה בדיקתי",
  phone: TEST_PHONE,
  city: "אשדוד",
  role_families: ["warehouse_worker"],
  shifts: ["morning"],
  experience: "lt1",
  consent_privacy: true,
  consent_marketing: true,
  landing_page_slug: "smoke-test-lp",
  website: "",
};
const post = (body) =>
  fetch(`${BASE}/api/public/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

try {
  // 1. LP gating
  const lpLive = await fetch(`${BASE}/lp/smoke-test-lp`);
  assert("live LP renders 200", lpLive.status === 200);
  const lpHtml = await lpLive.text();
  assert("LP HTML contains headline", lpHtml.includes("בדיקה"));
  const lp404 = await fetch(`${BASE}/lp/does-not-exist`);
  assert("unknown slug 404", lp404.status === 404);
  await sql(`update landing_pages set status='draft' where id=$1`, [lp.id]);
  const lpDraft = await fetch(`${BASE}/lp/smoke-test-lp`);
  assert("draft LP 404 (status gate)", lpDraft.status === 404);
  await sql(`update landing_pages set status='live' where id=$1`, [lp.id]);

  // 2. Valid submission
  const ok1 = await post(intakeBody);
  const ok1Body = await ok1.json();
  assert("valid intake 200 {ok:true}", ok1.status === 200 && ok1Body.ok === true);
  assert(
    "response echoes no candidate data",
    JSON.stringify(ok1Body) === '{"ok":true}'
  );

  // 3. Honeypot: silent ok, nothing written
  const before = (await sql(`select count(*)::int as n from candidate_submissions`))[0].n;
  const hp = await post({ ...intakeBody, website: "http://spam" });
  assert("honeypot returns ok", hp.status === 200);
  const after = (await sql(`select count(*)::int as n from candidate_submissions`))[0].n;
  assert("honeypot wrote nothing", after === before);

  // 4. Duplicate phone: silent upsert (1 candidate, 2 submissions)
  const ok2 = await post(intakeBody);
  assert("duplicate phone still 200", ok2.status === 200);
  const cand = await sql(`select count(*)::int as n from candidates where phone=$1`, [TEST_PHONE]);
  assert("single candidate row (upsert)", cand[0].n === 1);
  const subs = await sql(
    `select count(*)::int as n from candidate_submissions cs
     join candidates c on cs.candidate_id=c.id where c.phone=$1`,
    [TEST_PHONE]
  );
  assert("two submission rows", subs[0].n === 2, `got ${subs[0].n}`);

  // 5. Phone rate limit (limit 3/hour): third ok, fourth 429
  const ok3 = await post(intakeBody);
  assert("3rd submission 200 (at limit)", ok3.status === 200);
  const rl = await post(intakeBody);
  assert("4th submission 429 (phone rate limit)", rl.status === 429);

  // 6. Validation: missing consent → 400
  const noConsent = await post({ ...intakeBody, phone: "0559990002", consent_privacy: false });
  assert("missing privacy consent 400", noConsent.status === 400);
  const badPhone = await post({ ...intakeBody, phone: "12345" });
  assert("bad phone 400", badPhone.status === 400);

  // 7. Admin queue: masked by default
  await sql(`update users set admin_sub_role='super_admin' where id=$1`, [adminId]);
  const token = await new SignJWT({ sub: adminId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setIssuer("joby-shiftmatch").setExpirationTime("15m").sign(secret);
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const queue = await fetch(`${BASE}/api/admin/growth/intake?review_status=PENDING`, { headers: auth });
  const queueBody = await queue.json();
  assert("intake queue 200", queue.status === 200);
  const row = (queueBody.data || []).find((r) => r.candidate_name === "בדיקה בדיקתי");
  assert("submission visible in queue", !!row);
  assert("phone is masked", row && row.phone_masked === "055-***0001", row?.phone_masked);
  assert(
    "queue DTO has no raw phone/email/cv fields",
    row && !("phone" in row) && !("email" in row) && !("cv_file_ref" in row)
  );

  // 8. Unmask: reason required + audited; analyst gets 403
  const noReason = await fetch(`${BASE}/api/admin/growth/intake/${row.id}/unmask`, {
    method: "POST", headers: auth, body: JSON.stringify({ reason: "hi" }),
  });
  assert("unmask with short reason 400", noReason.status === 400);
  const um = await fetch(`${BASE}/api/admin/growth/intake/${row.id}/unmask`, {
    method: "POST", headers: auth, body: JSON.stringify({ reason: "smoke test verification" }),
  });
  const umBody = await um.json();
  assert("unmask 200 with full phone", um.status === 200 && umBody.data.phone === TEST_PHONE);
  const auditRows = await sql(
    `select count(*)::int as n from audit_logs where action='PII_UNMASKED' and entity_id=$1`,
    [umBody.data.candidate_id]
  );
  assert("PII_UNMASKED audit row written", auditRows[0].n >= 1);

  await sql(`update users set admin_sub_role='growth_analyst' where id=$1`, [adminId]);
  const umAnalyst = await fetch(`${BASE}/api/admin/growth/intake/${row.id}/unmask`, {
    method: "POST", headers: auth, body: JSON.stringify({ reason: "should be denied" }),
  });
  assert("analyst unmask 403", umAnalyst.status === 403);

  // 9. Review action (analyst has intake.review)
  const rev = await fetch(`${BASE}/api/admin/growth/intake/${row.id}/review`, {
    method: "POST", headers: auth, body: JSON.stringify({ review_status: "REVIEWED", quality_score: 70 }),
  });
  const revBody = await rev.json();
  assert("review 200 → REVIEWED", rev.status === 200 && revBody.data.review_status === "REVIEWED");
} finally {
  // --- cleanup (candidates cascade-deletes submissions) ---
  await sql(`delete from candidates where phone in ($1, $2)`, [TEST_PHONE, "0559990002"]);
  await sql(`delete from landing_pages where id=$1`, [lp.id]);
  await sql(`delete from intake_rate_limits`);
  await sql(`update users set admin_sub_role=null where id=$1`, [adminId]);
  console.log("🧹 cleaned up: candidates, submissions, LP, rate-limit rows, sub-role");
}

console.log(failures === 0 ? "\n✅ intake smoke test passed" : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
