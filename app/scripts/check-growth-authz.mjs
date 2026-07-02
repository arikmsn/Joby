#!/usr/bin/env node
// ============================================================
// Growth authz route-walk check (execution pack §7).
// Static gate: every route file under src/app/api/admin/growth/
// must wrap ALL of its exported HTTP handlers with withGrowthAuth.
// A growth route without the wrapper fails CI — "anything not
// explicitly admin-only is a security bug".
//
// Run: node scripts/check-growth-authz.mjs   (from app/)
// ============================================================

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const GROWTH_API_DIR = join(process.cwd(), "src", "app", "api", "admin", "growth");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function walk(dir) {
  let files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (entry === "route.ts" || entry === "route.tsx") files.push(full);
  }
  return files;
}

const routeFiles = walk(GROWTH_API_DIR);
if (routeFiles.length === 0) {
  console.error("check-growth-authz: no growth route files found — wrong cwd?");
  process.exit(1);
}

const failures = [];
for (const file of routeFiles) {
  const src = readFileSync(file, "utf8");
  const rel = relative(process.cwd(), file);

  // Cron job routes (growth/jobs/*) are machine-triggered: they must use the
  // cron secret (isAuthorizedCronRequest), not a user JWT.
  if (rel.includes("jobs")) {
    if (!src.includes("isAuthorizedCronRequest")) {
      failures.push(`${rel}: cron route must call isAuthorizedCronRequest`);
    }
    continue;
  }

  const exportedMethods = HTTP_METHODS.filter((m) =>
    new RegExp(
      `export\\s+(const\\s+${m}\\s*=|async\\s+function\\s+${m}\\b|function\\s+${m}\\b)`
    ).test(src)
  );

  if (exportedMethods.length === 0) {
    failures.push(`${rel}: no exported HTTP handlers found`);
    continue;
  }

  if (!src.includes("withGrowthAuth")) {
    failures.push(
      `${rel}: exports [${exportedMethods.join(", ")}] without withGrowthAuth`
    );
    continue;
  }

  // Every exported handler must be the wrapper result, not a bare function
  for (const m of exportedMethods) {
    const wrapped = new RegExp(
      `export\\s+const\\s+${m}\\s*=\\s*withGrowthAuth\\s*\\(`
    ).test(src);
    if (!wrapped) {
      failures.push(`${rel}: handler ${m} is not wrapped with withGrowthAuth`);
    }
  }
}

if (failures.length > 0) {
  console.error("❌ Growth authz check FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(
    "\nEvery /api/admin/growth/* handler must be `export const <METHOD> = withGrowthAuth(permission, handler)`."
  );
  process.exit(1);
}

console.log(
  `✅ Growth authz check passed: ${routeFiles.length} route file(s), all handlers wrapped with withGrowthAuth.`
);
