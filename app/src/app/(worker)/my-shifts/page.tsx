"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MapPin, Clock, Banknote, ClipboardList, ChevronLeft } from "lucide-react";

interface MyApplication {
  id: string;
  shift_id: string;
  status: string;
  is_backup: boolean;
  applied_at: string;
  approved_at: string | null;
  cancelled_at: string | null;
  shift_title: string;
  shift_role_tag: string;
  shift_city: string | null;
  shift_start_at: string;
  shift_end_at: string;
  shift_pay_rate: number;
  shift_pay_type: string;
  shift_status: string;
  shift_location_name: string | null;
  shift_address: string;
  business_name: string;
}

type Tab = "pending" | "approved" | "history";

const PENDING_STATUSES = ["PENDING"];
const APPROVED_STATUSES = ["APPROVED", "CONFIRMED", "CHECKED_IN"];
const HISTORY_STATUSES = [
  "REJECTED",
  "CANCELLED_BY_WORKER",
  "CANCELLED_BY_SYSTEM",
  "CHECKED_OUT",
  "NO_SHOW",
  "RATED",
];

function statusBadge(status: string, isBackup: boolean) {
  const map: Record<
    string,
    {
      label: string;
      variant:
        | "default"
        | "secondary"
        | "success"
        | "warning"
        | "danger"
        | "muted"
        | "info";
    }
  > = {
    PENDING: { label: t("application.status.pending"), variant: "warning" },
    APPROVED: {
      label: isBackup
        ? t("applicants.backup")
        : t("application.status.approved"),
      variant: isBackup ? "info" : "success",
    },
    CONFIRMED: {
      label: t("application.status.confirmed"),
      variant: "success",
    },
    REJECTED: { label: t("application.status.rejected"), variant: "danger" },
    CANCELLED_BY_WORKER: {
      label: t("application.status.cancelled_by_worker"),
      variant: "muted",
    },
    CANCELLED_BY_SYSTEM: {
      label: t("application.status.cancelled_by_system"),
      variant: "muted",
    },
    NO_SHOW: { label: t("application.status.no_show"), variant: "danger" },
    RATED: { label: t("application.status.rated"), variant: "default" },
    CHECKED_IN: {
      label: t("application.status.checked_in"),
      variant: "success",
    },
    CHECKED_OUT: {
      label: t("application.status.checked_out"),
      variant: "muted",
    },
  };
  const m = map[status] || { label: status, variant: "muted" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function statusAccent(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-warning";
    case "APPROVED":
    case "CONFIRMED":
    case "CHECKED_IN":
      return "bg-success";
    case "REJECTED":
    case "NO_SHOW":
      return "bg-danger";
    default:
      return "bg-border";
  }
}

export default function MyShiftsPage() {
  const { token } = useAuth();
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("approved");
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/worker/applications", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setApps(d.applications || []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAction(appId: string, action: "confirm" | "cancel") {
    setActionId(appId);
    try {
      const url =
        action === "confirm"
          ? `/api/applications/${appId}/confirm`
          : `/api/applications/${appId}/cancel`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApps((prev) =>
          prev.map((a) =>
            a.id === appId
              ? {
                  ...a,
                  status:
                    data.application?.status ||
                    (action === "cancel" ? "CANCELLED_BY_WORKER" : "CONFIRMED"),
                }
              : a
          )
        );
      }
    } catch {
      /* ignore */
    }
    setActionId(null);
  }

  const filtered = apps.filter((a) => {
    if (tab === "pending") return PENDING_STATUSES.includes(a.status);
    if (tab === "approved") return APPROVED_STATUSES.includes(a.status);
    return HISTORY_STATUSES.includes(a.status);
  });

  const emptyMsg =
    tab === "pending"
      ? t("my_shifts.no_pending")
      : tab === "approved"
        ? t("my_shifts.no_approved")
        : t("my_shifts.no_history");

  function fmt(iso: string) {
    return new Date(iso).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    {
      key: "pending",
      label: t("my_shifts.tab_pending"),
      count: apps.filter((a) => PENDING_STATUSES.includes(a.status)).length,
    },
    {
      key: "approved",
      label: t("my_shifts.tab_approved"),
      count: apps.filter((a) => APPROVED_STATUSES.includes(a.status)).length,
    },
    {
      key: "history",
      label: t("my_shifts.tab_history"),
      count: apps.filter((a) => HISTORY_STATUSES.includes(a.status)).length,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">
        {t("my_shifts.title")}
      </h1>

      {/* Tabs */}
      <div className="flex bg-surface rounded-xl border border-border p-1 gap-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === tb.key
                ? "bg-primary text-white shadow-sm"
                : "text-foreground-secondary hover:text-foreground hover:bg-gray-50"
            }`}
          >
            {tb.label}
            {tb.count > 0 && (
              <span
                className={`mr-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                  tab === tb.key
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-foreground-secondary"
                }`}
              >
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ClipboardList className="h-7 w-7 text-primary" />
          </div>
          <p className="text-foreground-secondary">{emptyMsg}</p>
          {tab !== "history" && (
            <Link
              href="/shifts"
              className="mt-4 inline-block rounded-full bg-primary/10 text-primary text-sm font-semibold px-4 py-2 hover:bg-primary/20 transition-colors"
            >
              {t("feed.title")}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((app) => (
            <div
              key={app.id}
              className="relative overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className={`absolute inset-y-0 right-0 w-1 ${statusAccent(app.status)}`} />
              <div className="p-4 pr-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <Link
                    href={`/shifts/${app.shift_id}`}
                    className="flex items-start gap-3 min-w-0 group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                      {(app.business_name || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {app.shift_title}
                      </div>
                      <p className="text-sm text-foreground-secondary truncate">
                        {app.business_name}
                      </p>
                    </div>
                  </Link>
                  {statusBadge(app.status, app.is_backup)}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-secondary mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-foreground-tertiary" />
                    {fmt(app.shift_start_at)}
                  </span>
                  {app.shift_city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-foreground-tertiary" />
                      {app.shift_city}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Banknote className="h-3.5 w-3.5 text-primary" />
                    {t("general.currency")}
                    {app.shift_pay_rate}{" "}
                    <span className="font-normal text-foreground-secondary">
                      {app.shift_pay_type === "hourly"
                        ? t("shift.per_hour")
                        : t("shift.total")}
                    </span>
                  </span>
                </div>

                {(app.status === "APPROVED" && !app.is_backup) ||
                tab === "pending" ||
                (tab === "approved" && app.status !== "CHECKED_IN") ? (
                  <div className="flex items-center gap-2 pt-3 border-t border-border-light">
                    {app.status === "APPROVED" && !app.is_backup && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(app.id, "confirm")}
                        loading={actionId === app.id}
                      >
                        {t("confirm.button")}
                      </Button>
                    )}
                    {(tab === "pending" ||
                      (tab === "approved" &&
                        app.status !== "CHECKED_IN")) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:text-danger hover:bg-danger/5"
                        onClick={() => {
                          if (confirm(t("apply.cancel_confirm")))
                            handleAction(app.id, "cancel");
                        }}
                        loading={actionId === app.id}
                      >
                        {t("apply.cancel")}
                      </Button>
                    )}
                    <Link
                      href={`/shifts/${app.shift_id}`}
                      className="flex items-center gap-1 text-sm text-foreground-tertiary hover:text-foreground-secondary transition-colors mr-auto"
                    >
                      {t("feed.view_details")}
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
