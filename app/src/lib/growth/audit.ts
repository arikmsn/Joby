// ============================================================
// Growth Engine — append-only audit log repository.
// Insert-only by design: no update/delete functions exist and
// none may be added. Entries carry ids/paths only — never PII.
// ============================================================

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/schema";
import type { GrowthAuditAction } from "@/lib/constants";

export interface GrowthAuditEntry {
  actor_id: string | null;
  action: GrowthAuditAction;
  entity_type?: string;
  entity_id?: string;
  reason?: string;
}

/**
 * Write an audit row. Best-effort: an audit failure is logged server-side
 * but never turns a handled request into a 500 (the deny/allow decision
 * has already been made by the caller).
 */
export async function logGrowthAudit(entry: GrowthAuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actor_id: entry.actor_id,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      reason: entry.reason ?? null,
    });
  } catch (err) {
    console.error("[growth-audit] failed to write audit row", {
      action: entry.action,
      entity_type: entry.entity_type,
      err,
    });
  }
}
