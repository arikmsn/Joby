"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton, ShiftListSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Plus,
  TrendingUp,
  FileEdit,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

interface DashboardShift {
  id: string;
  title: string;
  role_tag: string;
  city: string | null;
  start_at: string;
  end_at: string;
  pay_rate: string;
  pay_type: string;
  workers_needed: number;
  slots_filled: number;
  status: string;
  applicants?: { pending_count: number; backup_count: number };
}

interface CancellationAlert {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
}

interface DashboardData {
  today: DashboardShift[];
  upcoming: DashboardShift[];
  cancellation_alerts: CancellationAlert[];
  counts: {
    draft: number;
    published: number;
    cancelled: number;
    total: number;
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function statusVariant(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "success" as const;
    case "DRAFT":
      return "muted" as const;
    case "IN_PROGRESS":
      return "warning" as const;
    case "COMPLETED":
      return "info" as const;
    case "CANCELLED":
      return "danger" as const;
    default:
      return "secondary" as const;
  }
}

function statusLabel(status: string) {
  const key = `shift.status.${status.toLowerCase()}` as Parameters<typeof t>[0];
  return t(key);
}

function ShiftRow({ shift }: { shift: DashboardShift }) {
  const { occupationLabel } = useOccupations();
  const fillPercent = shift.workers_needed > 0
    ? Math.round((shift.slots_filled / shift.workers_needed) * 100)
    : 0;

  return (
    <Link
      href={`/manage-shifts/${shift.id}/attendance`}
      className="block p-4 rounded-2xl bg-surface border border-border hover:border-primary/30 hover:shadow-card-hover active:scale-[0.99] transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground truncate">{shift.title}</h3>
          <p className="text-sm text-foreground-secondary">{occupationLabel(shift.role_tag)}</p>
        </div>
        <Badge variant={statusVariant(shift.status)}>
          {statusLabel(shift.status)}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-secondary">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatTime(shift.start_at)} - {formatTime(shift.end_at)}
        </span>
        {shift.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {shift.city}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span className={fillPercent === 100 ? "text-success font-medium" : ""}>
            {shift.slots_filled}/{shift.workers_needed}
          </span>
        </span>
      </div>

      {shift.workers_needed > 0 && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              fillPercent === 100 ? "bg-success" : fillPercent > 50 ? "bg-primary" : "bg-warning"
            }`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      )}

      {(shift.applicants?.pending_count || shift.applicants?.backup_count) ? (
        <div className="flex items-center gap-2 mt-2">
          {!!shift.applicants?.pending_count && (
            <Badge variant="warning">
              {shift.applicants.pending_count}{" "}
              {shift.applicants.pending_count === 1 ? t("applicants.pending_one") : t("applicants.pending_many")}
            </Badge>
          )}
          {!!shift.applicants?.backup_count && (
            <Badge variant="info">
              {shift.applicants.backup_count}{" "}
              {shift.applicants.backup_count === 1 ? t("applicants.backup_count_one") : t("applicants.backup_count_many")}
            </Badge>
          )}
        </div>
      ) : null}
    </Link>
  );
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
    <Card className="p-4" interactive>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-sm text-foreground-secondary">{label}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/shifts/employer/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading)
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </Card>
          ))}
        </div>
        <ShiftListSkeleton rows={2} />
      </div>
    );

  if (!data)
    return (
      <p className="text-center py-8 text-danger">{t("error.generic")}</p>
    );

  async function dismissAlert(id: string) {
    if (!token) return;
    setData((prev) =>
      prev ? { ...prev, cancellation_alerts: prev.cancellation_alerts.filter((a) => a.id !== id) } : prev
    );
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Cancellation alerts */}
      {data.cancellation_alerts.length > 0 && (
        <div className="space-y-2">
          {data.cancellation_alerts.map((alert) => (
            <div
              key={alert.id}
              className="animate-pop-in flex items-start gap-3 p-3 rounded-xl bg-danger/10 border border-danger/30"
            >
              <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{alert.title}</p>
                {alert.body && <p className="text-sm text-foreground-secondary mt-0.5">{alert.body}</p>}
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="rounded-full p-1 text-foreground-tertiary transition-all duration-150 hover:bg-danger/10 hover:text-foreground-secondary active:scale-90"
                aria-label={t("general.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("nav.dashboard")}
          </h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {new Date().toLocaleDateString("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Link
          href="/manage-shifts/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover text-sm font-medium shadow-sm transition-all duration-150 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          {t("shift.create")}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t("dashboard.total_shifts")}
          value={data.counts.total}
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          accent="bg-primary/10"
        />
        <StatCard
          label={t("dashboard.published")}
          value={data.counts.published}
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          accent="bg-success/10"
        />
        <StatCard
          label={t("dashboard.drafts")}
          value={data.counts.draft}
          icon={<FileEdit className="h-4 w-4 text-warning" />}
          accent="bg-warning/10"
        />
        <StatCard
          label={t("dashboard.today")}
          value={data.today.length}
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          accent="bg-blue-50"
        />
      </div>

      {/* Today's Shifts */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          {t("dashboard.today")}
        </h2>
        {data.today.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-10 bg-surface rounded-2xl border border-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
              <CalendarDays className="h-5 w-5 text-foreground-tertiary" />
            </div>
            <p className="text-foreground-secondary text-sm">{t("dashboard.no_today")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.today.map((s) => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          {t("dashboard.upcoming")}
        </h2>
        {data.upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-10 bg-surface rounded-2xl border border-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
              <CalendarDays className="h-5 w-5 text-foreground-tertiary" />
            </div>
            <p className="text-foreground-secondary text-sm">
              {t("dashboard.no_upcoming")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.upcoming.map((s) => (
              <div key={s.id}>
                <div className="text-xs text-foreground-tertiary font-medium mb-1.5 px-1">
                  {formatDate(s.start_at)}
                </div>
                <ShiftRow shift={s} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
