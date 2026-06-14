"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Users, Building2, Clock, Banknote, Receipt, PiggyBank } from "lucide-react";

type Range = "today" | "month";

interface ByEmployer {
  employer_id: string;
  business_name: string;
  unique_workers: number;
  shifts: number;
  hours: number;
  estimated_billed: number;
  estimated_payout: number;
  estimated_platform_remainder: number;
}

interface ByWorker {
  worker_id: string;
  full_name: string;
  shifts: number;
  hours: number;
  estimated_payout: number;
}

interface AdminReportData {
  range: Range;
  fee_percent: number;
  totals: {
    workers_worked: number;
    employers_active: number;
    total_hours: number;
    estimated_worker_payout: number;
    estimated_employer_billing: number;
    estimated_platform_margin: number;
  };
  by_employer: ByEmployer[];
  by_worker: ByWorker[];
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

export default function AdminReportsPage() {
  const { token } = useAuth();
  const [range, setRange] = useState<Range>("today");
  const [data, setData] = useState<AdminReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4 max-w-5xl animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">{t("admin.reports.title")}</h1>

      <SegmentedControl
        className="max-w-xs"
        value={range}
        onChange={setRange}
        options={[
          { value: "today", label: t("admin.reports.range_today") },
          { value: "month", label: t("admin.reports.range_month") },
        ]}
      />

      {loading || !data ? (
        <p className="text-center py-8 text-foreground-tertiary">{t("general.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label={t("admin.reports.workers_worked")} value={data.totals.workers_worked} icon={<Users className="h-4 w-4 text-primary" />} />
            <StatCard label={t("admin.reports.employers_active")} value={data.totals.employers_active} icon={<Building2 className="h-4 w-4 text-primary" />} />
            <StatCard label={t("admin.reports.total_hours")} value={data.totals.total_hours} icon={<Clock className="h-4 w-4 text-primary" />} />
            <StatCard label={t("admin.reports.est_worker_payout")} value={`${t("general.currency")}${data.totals.estimated_worker_payout}`} icon={<Banknote className="h-4 w-4 text-primary" />} />
            <StatCard label={t("admin.reports.est_employer_billing")} value={`${t("general.currency")}${data.totals.estimated_employer_billing}`} icon={<Receipt className="h-4 w-4 text-primary" />} />
            <StatCard label={t("admin.reports.est_platform_margin")} value={`${t("general.currency")}${data.totals.estimated_platform_margin}`} icon={<PiggyBank className="h-4 w-4 text-primary" />} />
          </div>

          <p className="text-xs text-foreground-tertiary bg-background rounded-lg p-2.5">
            {t("admin.reports.estimate_disclaimer").replace("{fee}", String(data.fee_percent))}
          </p>

          <h2 className="text-lg font-semibold text-foreground">{t("admin.reports.breakdown_title")}</h2>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-foreground mb-3">{t("admin.reports.by_employer")}</h3>
              {data.by_employer.length === 0 ? (
                <p className="text-sm text-foreground-tertiary text-center py-4">{t("admin.reports.no_data")}</p>
              ) : (
                <div className="space-y-2 overflow-x-auto">
                  {data.by_employer.map((e) => (
                    <div key={e.employer_id} className="flex items-center justify-between border border-border rounded-xl p-3 gap-3">
                      <span className="font-medium text-foreground">{e.business_name}</span>
                      <div className="text-sm text-foreground-secondary flex items-center gap-3 whitespace-nowrap">
                        <span>{e.unique_workers} {t("reports.unique_workers")}</span>
                        <span>{e.shifts} {t("reports.shifts_short")}</span>
                        <span>{e.hours} {t("reports.hours_short")}</span>
                        <span>{t("admin.reports.est_employer_billing")}: {t("general.currency")}{e.estimated_billed}</span>
                        <span>{t("admin.reports.est_worker_payout")}: {t("general.currency")}{e.estimated_payout}</span>
                        <span className="font-medium text-foreground">{t("admin.reports.est_platform_margin")}: {t("general.currency")}{e.estimated_platform_remainder}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-foreground mb-3">{t("admin.reports.by_worker")}</h3>
              {data.by_worker.length === 0 ? (
                <p className="text-sm text-foreground-tertiary text-center py-4">{t("admin.reports.no_data")}</p>
              ) : (
                <div className="space-y-2">
                  {data.by_worker.map((w) => (
                    <div key={w.worker_id} className="flex items-center justify-between border border-border rounded-xl p-3">
                      <span className="font-medium text-foreground">{w.full_name}</span>
                      <div className="text-sm text-foreground-secondary flex items-center gap-3">
                        <span>{w.shifts} {t("reports.shifts_short")}</span>
                        <span>{w.hours} {t("reports.hours_short")}</span>
                        <span className="font-medium text-foreground">{t("general.currency")}{w.estimated_payout}</span>
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
