import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/he";
import { Users, Clock, ShieldAlert } from "lucide-react";

export interface StaffingCounts {
  workers_needed: number;
  slots_filled: number;
  pending_count: number;
  backup_count: number;
}

const AT_RISK_WINDOW_HOURS = 48;

function isUrgent(startAt?: string) {
  if (!startAt) return false;
  const hoursUntil = (new Date(startAt).getTime() - Date.now()) / 3_600_000;
  return hoursUntil >= 0 && hoursUntil <= AT_RISK_WINDOW_HOURS;
}

type Variant = "default" | "secondary" | "success" | "warning" | "danger" | "destructive" | "muted" | "urgent" | "info";

export function coverageStatus(c: StaffingCounts, startAt?: string): { label: string; variant: Variant } {
  if (c.slots_filled >= c.workers_needed) {
    return { label: t("staffing.covered"), variant: "success" };
  }
  if (c.slots_filled > 0) {
    return isUrgent(startAt)
      ? { label: t("staffing.at_risk"), variant: "danger" }
      : { label: t("staffing.partial"), variant: "warning" };
  }
  return isUrgent(startAt)
    ? { label: t("staffing.at_risk"), variant: "danger" }
    : { label: t("staffing.unfilled"), variant: "muted" };
}

/** Compact staffing badges row — approved/needed, coverage status, pending, backup. */
export function StaffingBadges({ counts, startAt }: { counts: StaffingCounts; startAt?: string }) {
  const coverage = coverageStatus(counts, startAt);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary">
        <Users className="h-3 w-3" />
        {counts.slots_filled}/{counts.workers_needed} {t("staffing.approved")}
      </Badge>
      <Badge variant={coverage.variant}>
        {coverage.variant === "danger" && <ShieldAlert className="h-3 w-3" />}
        {coverage.label}
      </Badge>
      {counts.pending_count > 0 && (
        <Badge variant="warning">
          <Clock className="h-3 w-3" />
          {counts.pending_count}{" "}
          {counts.pending_count === 1 ? t("applicants.pending_one") : t("applicants.pending_many")}
        </Badge>
      )}
      {counts.backup_count > 0 && (
        <Badge variant="info">
          {counts.backup_count}{" "}
          {counts.backup_count === 1 ? t("applicants.backup_count_one") : t("applicants.backup_count_many")}
        </Badge>
      )}
    </div>
  );
}
