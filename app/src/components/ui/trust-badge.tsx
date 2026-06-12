"use client";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n/he";
import { Config } from "@/lib/constants";
import { Shield } from "lucide-react";

interface TrustBadgeProps {
  score: number | string | null;
  totalShifts?: number;
  size?: "sm" | "md";
}

export function TrustBadge({ score, totalShifts, size = "sm" }: TrustBadgeProps) {
  const numScore = typeof score === "string" ? parseFloat(score) : (score ?? Config.TRUST_BASE_SCORE);
  const isNew = (totalShifts ?? 0) < Config.TRUST_NEW_WORKER_SHIFT_THRESHOLD;

  let colorClass = "text-success bg-success/10";
  if (numScore < 2) colorClass = "text-danger bg-danger/10";
  else if (numScore < 3.5) colorClass = "text-warning bg-warning/10";
  else if (numScore < 4.5) colorClass = "text-primary bg-primary/10";

  const label = isNew
    ? `${t("trust.new_worker")} · ${numScore.toFixed(1)}`
    : numScore.toFixed(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium",
        colorClass,
        size === "sm" ? "text-xs" : "text-sm"
      )}
    >
      <Shield className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label}
    </span>
  );
}
