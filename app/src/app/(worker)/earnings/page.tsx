"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Clock, Wallet, TrendingUp } from "lucide-react";

type Range = "today" | "week" | "month";

interface EarningsShift {
  application_id: string;
  shift_id: string;
  title: string;
  start_at: string;
  end_at: string;
  hours: number;
  estimated_pay: number;
  payment_status: string;
}

interface EarningsData {
  range: Range;
  totals: {
    shifts_completed: number;
    hours_worked: number;
    estimated_earnings: number;
    expected_earnings: number;
  };
  shifts: EarningsShift[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });
}

function paymentStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "warning" | "info" | "success" }> = {
    PENDING: { label: t("payment_status.pending"), variant: "warning" },
    APPROVED_FOR_PAYMENT: { label: t("payment_status.approved_for_payment"), variant: "info" },
    PAID: { label: t("payment_status.paid"), variant: "success" },
  };
  const m = map[status] || { label: status, variant: "warning" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-sm text-foreground-secondary">{label}</div>
    </Card>
  );
}

export default function EarningsPage() {
  const { token } = useAuth();
  const [range, setRange] = useState<Range>("today");
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workers/earnings?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-extrabold text-foreground tracking-tight">{t("earnings.title")}</h1>

      <SegmentedControl
        value={range}
        onChange={setRange}
        options={[
          { value: "today", label: t("earnings.range_today") },
          { value: "week", label: t("earnings.range_week") },
          { value: "month", label: t("earnings.range_month") },
        ]}
      />

      {loading || !data ? (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-9 w-9 rounded-xl mb-2" />
                <Skeleton className="h-6 w-12 mb-1.5" />
                <Skeleton className="h-3 w-16" />
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-4 w-28 mb-1" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label={t("earnings.shifts_completed")} value={data.totals.shifts_completed} icon={<Briefcase className="h-4 w-4 text-primary" />} />
            <StatCard label={t("earnings.hours_worked")} value={data.totals.hours_worked} icon={<Clock className="h-4 w-4 text-primary" />} />
            <StatCard label={t("earnings.completed_earnings")} value={`${t("general.currency")}${data.totals.estimated_earnings}`} icon={<Wallet className="h-4 w-4 text-primary" />} />
            <StatCard label={t("earnings.expected_earnings")} value={`${t("general.currency")}${data.totals.expected_earnings}`} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
          </div>

          <p className="text-xs text-foreground-tertiary bg-background rounded-lg p-2.5">{t("earnings.expected_earnings_disclaimer")}</p>

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold text-foreground mb-3">{t("earnings.shift_breakdown")}</h2>
              {data.shifts.length === 0 ? (
                <p className="text-sm text-foreground-tertiary text-center py-4">{t("earnings.no_shifts")}</p>
              ) : (
                <div className="space-y-3">
                  {data.shifts.map((s) => (
                    <div key={s.application_id} className="border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{s.title}</span>
                        {paymentStatusBadge(s.payment_status)}
                      </div>
                      <div className="text-sm text-foreground-tertiary mt-1 flex items-center gap-3">
                        <span>{fmtDate(s.start_at)}</span>
                        <span>{s.hours} {t("reports.hours_short")}</span>
                        <span className="font-medium text-foreground">{t("general.currency")}{s.estimated_pay}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
