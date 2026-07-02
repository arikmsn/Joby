#!/usr/bin/env node
// Growth module end-to-end smoke test (dev only).
// Signs a real admin JWT and walks: 403 without sub-role → bootstrap
// self-grant → sources propose/approve → observation create/duplicate
// → audit trail. Cleans up its test rows and revokes the role after.
// Run: node scripts/smoke-growth.mjs <admin-user-id>   (from app/, dev server on :3000)

import { SignJWT } from "jose";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const sql = neon(get("DATABASE_URL"));
const secret = new TextEncoder().encode(get("JWT_SECRET"));
const BASE = "http://localhost:3000";

const userId = process.argv[2];
if (!userId) {
  console.error("usage: node scripts/smoke-growth.mjs <admin-user-id>");
  process.exit(1);
}

const token = await new SignJWT({ sub: userId, role: "admin" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setIssuer("joby-shiftmatch")
  .setExpirationTime("15m")
  .sign(secret);

const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
let failures = 0;

async function check(name, expected, fn) {
  const res = await fn();
  const ok = res.status === expected;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${res.status} (expected ${expected})`);
  return res;
}

// Ensure clean starting state for this user
await sql(`update users set admin_sub_role = null where id = $1`, [userId]);

// 1. Admin WITHOUT sub-role → 403 (deny-by-default) + audit row
await check("no sub-role → sources 403", 403, () =>
  fetch(`${BASE}/api/admin/growth/sources`, { headers: auth })
);

// 2. Bootstrap self-grant of super_admin (only possible while none exists)
await check("bootstrap self-grant super_admin", 200, () =>
  fetch(`${BASE}/api/admin/growth/roles/grant`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ user_id: userId, sub_role: "super_admin" }),
  })
);

// 3. Now sources readable
await check("with super_admin → sources 200", 200, () =>
  fetch(`${BASE}/api/admin/growth/sources`, { headers: auth })
);

// 4. Propose + approve a channel
const proposeRes = await check("propose source 201", 201, () =>
  fetch(`${BASE}/api/admin/growth/sources`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      type: "board",
      name: "TEST — smoke channel",
      url: "https://example.com/jobs",
      collection_method: "manual",
      risk_tier: "high",
      robots_tos_notes: "smoke test",
    }),
  })
);
const channelId = (await proposeRes.json()).data.id;

await check("approve high-risk as super_admin 200", 200, () =>
  fetch(`${BASE}/api/admin/growth/sources/${channelId}/status`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ status: "approved" }),
  })
);

// 5. Observation create + duplicate rejection
const obsBody = {
  channel_id: channelId,
  observed_at: new Date().toISOString(),
  role_family: "warehouse_worker",
  role_title_norm: "מחסנאי בוקר — בדיקה",
  region_code: "shfela_ashdod",
  city: "אשדוד",
  employer_name_public: "TEST Corp",
  employer_type: "direct",
  salary_min: 45,
  salary_max: 55,
  salary_unit: "hourly",
  shift_tags: ["morning"],
  requirement_flags: ["physical_work"],
  urgency_score: 5,
  raw_text: "smoke raw text",
};
const obsRes = await check("create observation 201", 201, () =>
  fetch(`${BASE}/api/admin/growth/observations`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify(obsBody),
  })
);
const obsId = (await obsRes.json()).data.id;

await check("duplicate observation 409", 409, () =>
  fetch(`${BASE}/api/admin/growth/observations`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify(obsBody),
  })
);

// 6. Downgrade to analyst → approve endpoint must 403
await sql(`update users set admin_sub_role = 'growth_analyst' where id = $1`, [userId]);
await check("analyst cannot approve sources 403", 403, () =>
  fetch(`${BASE}/api/admin/growth/sources/${channelId}/status`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ status: "paused" }),
  })
);
await check("analyst cannot read audit 403", 403, () =>
  fetch(`${BASE}/api/admin/growth/audit`, { headers: auth })
);
await sql(`update users set admin_sub_role = 'super_admin' where id = $1`, [userId]);

// 7. Audit trail contains the expected actions
const auditRes = await fetch(`${BASE}/api/admin/growth/audit?limit=20`, { headers: auth });
const audit = await auditRes.json();
const actions = (audit.data || []).map((r) => r.action);
for (const expected of ["ROLE_GRANTED", "SOURCE_STATUS_CHANGED", "AUTHZ_DENIED"]) {
  const ok = actions.includes(expected);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} audit contains ${expected}`);
}

// Cleanup: test rows + revoke role (leave DB as found; audit rows remain by design)
await sql(`delete from source_jobs where id = $1`, [obsId]);
await sql(`delete from source_channels where id = $1`, [channelId]);
await sql(`update users set admin_sub_role = null where id = $1`, [userId]);
console.log("🧹 cleaned up test rows and revoked test sub-role");

console.log(failures === 0 ? "\n✅ smoke test passed" : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
