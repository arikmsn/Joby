"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import {
  Building2,
  Users,
  CalendarDays,
  Clock,
  AlertTriangle,
  Siren,
} from "lucide-react";

interface OverviewData {
  employers: number;
  workers: number;
  shifts: {
    total: number;
    by_status: Record<string, number>;
  };
  pending_applications: number;
  active_sos: number;
  open_incidents: number;
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-foreground-secondary">{label}</div>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { token } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/overview", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center py-8 text-danger">{t("error.generic")}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t("nav.overview")}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t("admin.overview.employers")}
          value={data.employers}
          icon={<Building2 className="h-4 w-4 text-primary" />}
          accent="bg-primary/10"
        />
        <StatCard
          label={t("admin.overview.workers")}
          value={data.workers}
          icon={<Users className="h-4 w-4 text-primary" />}
          accent="bg-primary/10"
        />
        <StatCard
          label={t("admin.overview.total_shifts")}
          value={data.shifts.total}
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          accent="bg-primary/10"
        />
        <StatCard
          label={t("admin.overview.pending_applications")}
          value={data.pending_applications}
          icon={<Clock className="h-4 w-4 text-warning" />}
          accent="bg-warning/10"
        />
        <StatCard
          label={t("admin.overview.active_sos")}
          value={data.active_sos}
          icon={<Siren className="h-4 w-4 text-danger" />}
          accent="bg-danger/10"
        />
        <StatCard
          label={t("admin.overview.open_incidents")}
          value={data.open_incidents}
          icon={<AlertTriangle className="h-4 w-4 text-danger" />}
          accent="bg-danger/10"
        />
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t("admin.overview.shifts_by_status")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(data.shifts.by_status).map(([status, count]) => (
            <div key={status} className="text-center p-3 bg-background rounded-lg">
              <div className="text-lg font-bold text-foreground">{count}</div>
              <div className="text-xs text-foreground-secondary">
                {t(`shift.status.${status.toLowerCase()}` as Parameters<typeof t>[0])}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
