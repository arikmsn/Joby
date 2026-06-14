"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Users, CalendarCheck, Clock, Banknote } from "lucide-react";

type Range = "today" | "week" | "month";

interface ByWorker {
  worker_id: string;
  full_name: string;
  shifts: number;
  hours: number;
  estimated_pay: number;
}

interface ByDay {
  date: string;
  shifts: number;
  hours: number;
  estimated_pay: number;
}

interface ReportData {
  range: Range;
  totals: {
    unique_workers: number;
    completed_shifts: number;
    total_hours: number;
    estimated_pay: number;
  };
  by_worker: ByWorker[];
  by_day: ByDay[];
}

function fmtDate(key: string) {
  return new Date(key).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });
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

export default function EmployerReportsPage() {
  const { token } = useAuth();
  const [range, setRange] = useState<Range>("today");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/employers/reports?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">{t("reports.title")}</h1>

      <SegmentedControl
        value={range}
        onChange={setRange}
        options={[
          { value: "today", label: t("reports.range_today") },
          { value: "week", label: t("reports.range_week") },
          { value: "month", label: t("reports.range_month") },
        ]}
      />

      {loading || !data ? (
        <p className="text-center py-8 text-foreground-tertiary">{t("general.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={t("reports.unique_workers")} value={data.totals.unique_workers} icon={<Users className="h-4 w-4 text-primary" />} />
            <StatCard label={t("reports.completed_shifts")} value={data.totals.completed_shifts} icon={<CalendarCheck className="h-4 w-4 text-primary" />} />
            <StatCard label={t("reports.total_hours")} value={data.totals.total_hours} icon={<Clock className="h-4 w-4 text-primary" />} />
            <StatCard label={t("reports.estimated_pay")} value={`${t("general.currency")}${data.totals.estimated_pay}`} icon={<Banknote className="h-4 w-4 text-primary" />} />
          </div>

          <p className="text-xs text-foreground-tertiary bg-background rounded-lg p-2.5">{t("reports.estimate_disclaimer")}</p>

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold text-foreground mb-3">{t("reports.by_worker")}</h2>
              {data.by_worker.length === 0 ? (
                <p className="text-sm text-foreground-tertiary text-center py-4">{t("reports.no_data")}</p>
              ) : (
                <div className="space-y-2">
                  {data.by_worker.map((w) => (
                    <div key={w.worker_id} className="flex items-center justify-between border border-border rounded-xl p-3">
                      <span className="font-medium text-foreground">{w.full_name}</span>
                      <div className="text-sm text-foreground-secondary flex items-center gap-3">
                        <span>{w.shifts} {t("reports.shifts_short")}</span>
                        <span>{w.hours} {t("reports.hours_short")}</span>
                        <span className="font-medium text-foreground">{t("general.currency")}{w.estimated_pay}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold text-foreground mb-3">{t("reports.by_day")}</h2>
              {data.by_day.length === 0 ? (
                <p className="text-sm text-foreground-tertiary text-center py-4">{t("reports.no_data")}</p>
              ) : (
                <div className="space-y-2">
                  {data.by_day.map((d) => (
                    <div key={d.date} className="flex items-center justify-between border border-border rounded-xl p-3">
                      <span className="font-medium text-foreground">{fmtDate(d.date)}</span>
                      <div className="text-sm text-foreground-secondary flex items-center gap-3">
                        <span>{d.shifts} {t("reports.shifts_short")}</span>
                        <span>{d.hours} {t("reports.hours_short")}</span>
                        <span className="font-medium text-foreground">{t("general.currency")}{d.estimated_pay}</span>
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
