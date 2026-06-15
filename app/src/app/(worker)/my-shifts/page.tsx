"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { Config } from "@/lib/constants";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { EmployerAvatar } from "@/components/ui/employer-avatar";
import { CelebrationToast } from "@/components/ui/celebration-toast";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ShiftListSkeleton } from "@/components/ui/skeleton";
import { Calendar, QrCode } from "lucide-react";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Banknote,
  ChevronLeft,
  ChevronDown,
  Navigation,
  Phone,
} from "lucide-react";

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
  shift_arrival_notes: string | null;
  shift_contact_name: string | null;
  shift_contact_phone: string | null;
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

const SEEN_APPROVALS_KEY = "joby_seen_approvals";

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

function canScanQr(app: MyApplication): boolean {
  if (app.is_backup) return false;
  if (app.status === "CHECKED_IN") return true;
  if (app.status !== "APPROVED" && app.status !== "CONFIRMED") return false;
  const now = new Date();
  const start = new Date(app.shift_start_at);
  const windowStart = new Date(start.getTime() - Config.CHECKIN_WINDOW_BEFORE_MINUTES * 60000);
  return now >= windowStart;
}

export default function MyShiftsPage() {
  const { token } = useAuth();
  const { occupationLabel } = useOccupations();
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("approved");
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<MyApplication | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ appId: string; late: boolean } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/worker/applications", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const list: MyApplication[] = d.applications || [];
        setApps(list);

        let seen: string[] = [];
        try {
          seen = JSON.parse(localStorage.getItem(SEEN_APPROVALS_KEY) || "[]");
        } catch {
          seen = [];
        }
        const newlyApproved = list.find(
          (a) =>
            ["APPROVED", "CONFIRMED"].includes(a.status) &&
            !a.is_backup &&
            !seen.includes(a.id)
        );
        if (newlyApproved) {
          setCelebration(newlyApproved);
        }
        const approvedIds = list
          .filter((a) => ["APPROVED", "CONFIRMED", "CHECKED_IN"].includes(a.status))
          .map((a) => a.id);
        try {
          localStorage.setItem(SEEN_APPROVALS_KEY, JSON.stringify(approvedIds));
        } catch { /* ignore */ }
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAction(appId: string) {
    setActionId(appId);
    try {
      const url = `/api/applications/${appId}/cancel`;
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
                  status: data.application?.status || "CANCELLED_BY_WORKER",
                }
              : a
          )
        );
      }
    } catch { /* ignore */ }
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

  function formatPay(rate: number) {
    const n = Number(rate);
    return n % 1 === 0 ? n.toString() : n.toFixed(2);
  }

  function fmtTimeOnly(iso: string) {
    return new Date(iso).toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fmtDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = (target.getTime() - today.getTime()) / 86400000;
    if (diff === 0) return t("shift.day_today");
    if (diff === 1) return t("shift.day_tomorrow");
    return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });
  }

  function mapsUrl(app: MyApplication) {
    const query = encodeURIComponent(
      [app.shift_location_name, app.shift_address, app.shift_city].filter(Boolean).join(", ")
    );
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
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
      {celebration && (
        <CelebrationToast
          title={t("celebration.title")}
          subtitle={`${celebration.business_name} · ${celebration.shift_title}`}
          onDismiss={() => setCelebration(null)}
        />
      )}

      <div>
        <h1 className="text-xl font-extrabold text-foreground tracking-tight">
          {t("my_shifts.title")}
        </h1>
        <p className="text-sm text-foreground-secondary mt-0.5">
          {t("my_shifts.subtitle")}
        </p>
      </div>

      <SegmentedControl
        layoutId="my-shifts-tab-pill"
        options={tabs.map((tb) => ({
          value: tb.key,
          label: tb.label,
          badge: tb.count,
        }))}
        value={tab}
        onChange={setTab}
      />

      {loading ? (
        <ShiftListSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <Card className="animate-fade-in flex flex-col items-center gap-3 px-4 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background">
            <Calendar className="h-6 w-6 text-foreground-tertiary" />
          </div>
          <p className="text-foreground-secondary">{emptyMsg}</p>
          {tab !== "history" && (
            <Link
              href="/shifts"
              className="mt-1 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold px-4 py-2 transition-all duration-150 hover:bg-primary/20 active:scale-[0.97]"
            >
              {t("feed.title")}
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((app, i) => {
            const hasArrivalInfo =
              app.shift_location_name ||
              app.shift_address ||
              app.shift_arrival_notes ||
              app.shift_contact_name ||
              app.shift_contact_phone;
            const expanded = expandedId === app.id;
            const showQr = tab === "approved" && canScanQr(app);

            const accentColor =
              tab === "approved"
                ? "bg-primary"
                : tab === "pending"
                  ? "bg-warning"
                  : ["RATED", "CHECKED_OUT"].includes(app.status)
                    ? "bg-success"
                    : "bg-foreground-tertiary";

            return (
              <Card
                key={app.id}
                className={`animate-card-pop relative overflow-hidden ${
                  showQr
                    ? "approved-glow border-primary/30 shadow-card"
                    : ""
                }`}
                style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              >
                <span className={`absolute inset-y-0 end-0 w-1 ${accentColor}`} />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <EmployerAvatar name={app.business_name || app.shift_title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/shifts/${app.shift_id}`} className="min-w-0 group">
                          <div className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {app.shift_title}
                          </div>
                          <p className="text-sm text-foreground-secondary truncate mt-0.5">
                            {app.business_name} · {occupationLabel(app.shift_role_tag)}
                          </p>
                        </Link>
                        {/* Show QR action or status badge */}
                        {showQr ? (
                          <Link
                            href={`/scan?shiftId=${app.shift_id}`}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.96]"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            {t("my_shifts.qr_action")}
                          </Link>
                        ) : (
                          statusBadge(app.status, app.is_backup)
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-secondary mt-2">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Clock className="h-3.5 w-3.5 text-foreground-tertiary" />
                          {fmtDate(app.shift_start_at)} · {fmtTimeOnly(app.shift_start_at)}–{fmtTimeOnly(app.shift_end_at)}
                        </span>
                        {app.shift_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-foreground-tertiary" />
                            {app.shift_city}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-bold text-foreground font-numeric tabular-nums">
                          <Banknote className="h-3.5 w-3.5 text-foreground-tertiary" />
                          {t("general.currency")}
                          {formatPay(app.shift_pay_rate)}{" "}
                          <span className="font-normal text-foreground-secondary">
                            {app.shift_pay_type === "hourly"
                              ? t("shift.per_hour")
                              : t("shift.total")}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrival details */}
                {tab === "approved" && !app.is_backup && hasArrivalInfo && (
                  <div className="border-t border-border-light">
                    <button
                      onClick={() => setExpandedId(expanded ? null : app.id)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-background transition-colors"
                    >
                      {expanded ? t("shift.hide_details") : t("shift.arrival_details")}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {expanded && (
                      <div className="px-4 pb-3 space-y-2 text-sm">
                        {(app.shift_location_name || app.shift_address) && (
                          <div className="flex items-start gap-2 text-foreground-secondary">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-foreground-tertiary" />
                            <div>
                              {app.shift_location_name && (
                                <div className="font-medium text-foreground">
                                  {app.shift_location_name}
                                </div>
                              )}
                              <div>{app.shift_address}</div>
                            </div>
                          </div>
                        )}
                        {app.shift_arrival_notes && (
                          <div className="flex items-start gap-2 text-foreground-secondary">
                            <Navigation className="h-4 w-4 mt-0.5 shrink-0 text-foreground-tertiary" />
                            <span>{app.shift_arrival_notes}</span>
                          </div>
                        )}
                        {app.shift_contact_name && (
                          <div className="flex items-center gap-2 text-foreground-secondary">
                            <Phone className="h-4 w-4 shrink-0 text-foreground-tertiary" />
                            <span>{app.shift_contact_name}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <a
                            href={mapsUrl(app)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1"
                          >
                            <Button variant="secondary" size="sm" className="w-full">
                              <Navigation className="h-3.5 w-3.5" />
                              {t("shift.open_navigation")}
                            </Button>
                          </a>
                          {app.shift_contact_phone && (
                            <a href={`tel:${app.shift_contact_phone}`} className="flex-1">
                              <Button variant="secondary" size="sm" className="w-full">
                                <Phone className="h-3.5 w-3.5" />
                                {t("shift.call_contact")}
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {tab === "pending" && (
                  <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-border-light">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger hover:bg-danger/5 active:scale-[0.97]"
                      onClick={() => setCancelTarget({ appId: app.id, late: false })}
                      loading={actionId === app.id}
                    >
                      {t("apply.cancel")}
                    </Button>
                    <Link
                      href={`/shifts/${app.shift_id}`}
                      className="flex items-center gap-1 text-sm text-foreground-tertiary hover:text-foreground-secondary transition-colors mr-auto"
                    >
                      {t("feed.view_details")}
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
                {tab === "approved" && app.status !== "CHECKED_IN" && (
                  <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-border-light">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger hover:bg-danger/5 active:scale-[0.97]"
                      onClick={() => {
                        const hoursUntilStart =
                          (new Date(app.shift_start_at).getTime() - Date.now()) / (1000 * 60 * 60);
                        const isLate = hoursUntilStart <= Config.LATE_CANCEL_WINDOW_HOURS;
                        setCancelTarget({ appId: app.id, late: isLate });
                      }}
                      loading={actionId === app.id}
                    >
                      {t("apply.cancel")}
                    </Button>
                    <Link
                      href={`/shifts/${app.shift_id}`}
                      className="flex items-center gap-1 text-sm text-foreground-tertiary hover:text-foreground-secondary transition-colors mr-auto"
                    >
                      {t("feed.view_details")}
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={
          cancelTarget?.late
            ? t("apply.cancel_late_dialog_title")
            : t("apply.cancel_dialog_title")
        }
      >
        <div className="space-y-4 pb-2">
          <p className="text-sm text-foreground-secondary">
            {cancelTarget?.late
              ? t("apply.cancel_late_confirm")
              : t("apply.cancel_confirm")}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setCancelTarget(null)}
            >
              {t("general.cancel")}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={!!cancelTarget && actionId === cancelTarget.appId}
              onClick={() => {
                if (!cancelTarget) return;
                const appId = cancelTarget.appId;
                setCancelTarget(null);
                handleAction(appId);
              }}
            >
              {t("apply.cancel")}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
