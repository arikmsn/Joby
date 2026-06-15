"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployerAvatar } from "@/components/ui/employer-avatar";
import {
  MapPin,
  Clock,
  Shirt,
  Wrench,
  Navigation,
  Phone,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  Briefcase,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { WorkerProfile } from "@/lib/types";

interface ShiftDetail {
  id: string;
  title: string;
  role_tag: string;
  description: string | null;
  location_name: string | null;
  city: string | null;
  address: string;
  start_at: string;
  end_at: string;
  pay_rate: number;
  pay_type: string;
  workers_needed: number;
  slots_filled: number;
  status: string;
  dress_code: string | null;
  gear_required: string | null;
  arrival_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  requirements_ack: string | null;
  employer_name: string;
  business_name: string;
  has_sos?: boolean;
  my_application?: { id: string; status: string; is_backup: boolean } | null;
}

function applicationStatusInfo(status: string, isBackup: boolean): { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "muted" | "info" } {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "muted" | "info" }> = {
    PENDING: { label: t("application.status.pending"), variant: "warning" },
    APPROVED: {
      label: isBackup ? t("applicants.backup") : t("application.status.approved"),
      variant: isBackup ? "info" : "success",
    },
    CONFIRMED: { label: t("application.status.confirmed"), variant: "success" },
    UNCONFIRMED: { label: t("application.status.unconfirmed"), variant: "warning" },
    REJECTED: { label: t("application.status.rejected"), variant: "danger" },
    CANCELLED_BY_WORKER: { label: t("application.status.cancelled_by_worker"), variant: "muted" },
    CANCELLED_BY_SYSTEM: { label: t("application.status.cancelled_by_system"), variant: "muted" },
    NO_SHOW: { label: t("application.status.no_show"), variant: "danger" },
    RATED: { label: t("application.status.rated"), variant: "default" },
    CHECKED_IN: { label: t("application.status.checked_in"), variant: "success" },
    CHECKED_OUT: { label: t("application.status.checked_out"), variant: "muted" },
  };
  return map[status] || { label: status, variant: "muted" };
}

export default function ShiftDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const shiftId = params.id as string;
  const { token, profile } = useAuth();
  const workerProfile = profile as WorkerProfile | null;
  const { occupationLabel } = useOccupations();
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [overlapShiftId, setOverlapShiftId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !shiftId) return;
    fetch(`/api/shifts/${shiftId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setShift(d.shift || null);
        if (!d.shift) setError(t("error.shift_not_found"));
      })
      .catch(() => setError(t("error.generic")))
      .finally(() => setLoading(false));
  }, [token, shiftId]);

  async function handleApply() {
    if (!token) return;
    setApplying(true);
    setApplyMsg("");
    setOverlapShiftId(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ acknowledged }),
      });
      const data = await res.json();
      if (res.ok) {
        setShift((prev) => (prev ? { ...prev, my_application: { id: data.application.id, status: data.application.status, is_backup: data.application.is_backup } } : prev));
        setApplyMsg(data.message || t("apply.success"));
      } else {
        setApplyMsg(data.message || t("error.generic"));
        if (res.status === 409 && data.error === "DUPLICATE") {
          // Re-fetch to get the existing application's real status
          const r = await fetch(`/api/shifts/${shiftId}`, { headers: { Authorization: `Bearer ${token}` } });
          const d = await r.json();
          if (d.shift) setShift(d.shift);
        }
        if (res.status === 409 && data.error === "OVERLAP" && data.overlap_shift_id) {
          setOverlapShiftId(data.overlap_shift_id);
        }
      }
    } catch {
      setApplyMsg(t("error.generic"));
    } finally {
      setApplying(false);
    }
  }

  if (loading)
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-16" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-2/3" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex items-end justify-between pt-3 border-t border-border-light">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );

  if (error || !shift)
    return (
      <div className="text-center py-20 px-4 animate-fade-in">
        <p className="font-semibold text-foreground">
          {error || t("error.shift_not_found")}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-full bg-primary/10 text-primary text-sm font-semibold px-4 py-2 transition-all duration-150 hover:bg-primary/20 active:scale-[0.97]"
        >
          {t("general.back")}
        </button>
      </div>
    );

  function fmt(iso: string) {
    return new Date(iso).toLocaleString("he-IL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function duration(start: string, end: string) {
    const h =
      Math.round(
        ((new Date(end).getTime() - new Date(start).getTime()) / 3600000) * 10
      ) / 10;
    return `${h} שעות`;
  }

  function formatPay(rate: number) {
    const n = Number(rate);
    return n % 1 === 0 ? n.toString() : n.toFixed(2);
  }

  const preferredRoles = workerProfile?.experience_tags || [];
  const preferredCities = workerProfile?.preferred_cities || [];
  const fitReasons: { key: string; icon: React.ReactNode; label: string }[] = [];
  if (preferredRoles.includes(shift.role_tag)) {
    fitReasons.push({ key: "role", icon: <Briefcase className="h-3 w-3" />, label: t("feed.match_role") });
  }
  if (shift.city && preferredCities.includes(shift.city)) {
    fitReasons.push({ key: "city", icon: <MapPin className="h-3 w-3" />, label: t("feed.match_city") });
  }
  if (
    workerProfile?.min_pay != null &&
    shift.pay_type === "hourly" &&
    Number(shift.pay_rate) >= workerProfile.min_pay
  ) {
    fitReasons.push({ key: "pay", icon: <Wallet className="h-3 w-3" />, label: t("feed.match_pay") });
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-foreground-secondary transition-colors hover:text-foreground active:scale-[0.97]"
      >
        <ArrowRight className="h-4 w-4" />
        {t("general.back")}
      </button>

      {/* Header */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {occupationLabel(shift.role_tag)}
          </span>
          {shift.has_sos && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
              <AlertTriangle className="h-3 w-3" />
              {t("sos.badge")}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground leading-snug">{shift.title}</h1>
        <div className="flex items-center gap-2.5">
          <EmployerAvatar name={shift.business_name || shift.title} size="sm" />
          <p className="text-foreground-secondary text-sm">
            <span className="font-medium text-foreground">{shift.business_name}</span>
            {" · "}
            {t("shift.employer_verified")}
          </p>
        </div>

        <div className="flex items-end justify-between pt-3 border-t border-border-light">
          <div>
            <div className="text-3xl font-bold text-foreground text-right" dir="ltr">
              {t("general.currency")}{formatPay(shift.pay_rate)}
            </div>
            <div className="text-sm text-foreground-tertiary mt-0.5">
              {shift.pay_type === "hourly" ? t("shift.per_hour") : t("shift.total")}
            </div>
          </div>
        </div>
      </Card>

      {/* Key details */}
      <Card className="divide-y divide-border-light p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 text-sm">
          <Clock className="h-4 w-4 text-foreground-tertiary shrink-0" />
          <div>
            <div className="text-foreground font-medium">
              {fmt(shift.start_at)} — {fmt(shift.end_at)}
            </div>
            <div className="text-foreground-secondary">
              {duration(shift.start_at, shift.end_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5 text-sm">
          <MapPin className="h-4 w-4 text-foreground-tertiary shrink-0" />
          <div>
            {shift.location_name && (
              <div className="font-medium text-foreground">
                {shift.location_name}
              </div>
            )}
            <div className="text-foreground-secondary">{shift.address}</div>
            {shift.city && (
              <div className="text-foreground-tertiary">{shift.city}</div>
            )}
          </div>
        </div>
      </Card>

      {/* Why am I seeing this */}
      {fitReasons.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground-secondary">{t("shift.why_shown")}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {fitReasons.slice(0, 3).map((r) => (
              <span
                key={r.key}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                {r.icon}
                {r.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-foreground-tertiary leading-relaxed">
          <span className="font-medium text-foreground-secondary">{t("shift.why_shown")}</span>{" "}
          {t("shift.why_shown_text")}
        </p>
      )}

      {/* Description */}
      {shift.description && (
        <Card>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary mb-2">
            {t("shift.description")}
          </h3>
          <p className="text-sm text-foreground-secondary whitespace-pre-line leading-relaxed">
            {shift.description}
          </p>
        </Card>
      )}

      {/* Requirements */}
      {(shift.dress_code || shift.gear_required || shift.arrival_notes || shift.requirements_ack) && (
        <Card className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
            {t("shift.requirements")}
          </h3>
          {shift.dress_code && (
            <div className="flex items-start gap-3 text-sm">
              <Shirt className="h-4 w-4 text-foreground-tertiary mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-foreground">
                  {t("shift.dress_code")}:
                </span>{" "}
                <span className="text-foreground-secondary">
                  {shift.dress_code}
                </span>
              </div>
            </div>
          )}
          {shift.gear_required && (
            <div className="flex items-start gap-3 text-sm">
              <Wrench className="h-4 w-4 text-foreground-tertiary mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-foreground">
                  {t("shift.gear_required")}:
                </span>{" "}
                <span className="text-foreground-secondary">
                  {shift.gear_required}
                </span>
              </div>
            </div>
          )}
          {shift.arrival_notes && (
            <div className="flex items-start gap-3 text-sm">
              <Navigation className="h-4 w-4 text-foreground-tertiary mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-foreground">
                  {t("shift.arrival_notes")}:
                </span>{" "}
                <span className="text-foreground-secondary">
                  {shift.arrival_notes}
                </span>
              </div>
            </div>
          )}
          {shift.requirements_ack && (
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-foreground-tertiary mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-foreground">
                  {t("apply.requirements_title")}:
                </span>{" "}
                <span className="text-foreground-secondary whitespace-pre-line">
                  {shift.requirements_ack}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Contact */}
      {(shift.contact_name || shift.contact_phone) && (
        <Card className="space-y-2">
          {shift.contact_name && (
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-foreground-tertiary shrink-0" />
              <span className="text-foreground">{shift.contact_name}</span>
            </div>
          )}
          {shift.contact_phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-foreground-tertiary shrink-0" />
              <a
                href={`tel:${shift.contact_phone}`}
                dir="ltr"
                className="text-primary transition-colors hover:underline"
              >
                {shift.contact_phone}
              </a>
            </div>
          )}
        </Card>
      )}

      {/* Spacer so the sticky apply bar never covers the content above it */}
      <div className="h-1" aria-hidden="true" />

      {/* Apply section */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-surface border-t border-border shadow-[0_-2px_12px_-1px_rgb(0_0_0_/_0.04)] space-y-2">
        {shift.my_application && shift.my_application.status === "CANCELLED_BY_WORKER" &&
        shift.status === "PUBLISHED" && new Date(shift.start_at) > new Date() ? (
          <>
            <div className="flex items-center justify-center gap-2 py-1">
              <Badge variant="muted">
                {applicationStatusInfo(shift.my_application.status, shift.my_application.is_backup).label}
              </Badge>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleApply}
              loading={applying}
            >
              {t("apply.reapply_button")}
            </Button>
            <p className="text-xs text-foreground-tertiary text-center">
              {t("apply.not_commitment")}
            </p>
          </>
        ) : shift.my_application && shift.my_application.status === "PENDING" ? (
          <div className="flex items-center gap-3 rounded-xl bg-warning/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-warning shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{t("application.pending_title")}</p>
              <p className="text-xs text-foreground-secondary">{t("application.pending_sub")}</p>
            </div>
          </div>
        ) : shift.my_application ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 py-1">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <Badge variant={applicationStatusInfo(shift.my_application.status, shift.my_application.is_backup).variant}>
                {applicationStatusInfo(shift.my_application.status, shift.my_application.is_backup).label}
              </Badge>
            </div>
            {!shift.my_application.is_backup &&
              ["APPROVED", "CONFIRMED", "CHECKED_IN"].includes(shift.my_application.status) && (
                <div className="flex gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [shift.location_name, shift.address, shift.city].filter(Boolean).join(", ")
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="secondary" className="w-full" size="lg">
                      <Navigation className="h-4 w-4" />
                      {t("shift.open_navigation")}
                    </Button>
                  </a>
                  <Link href={`/scan?shiftId=${shift.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full" size="lg">
                      <ScanLine className="h-4 w-4" />
                      {shift.my_application.status === "CHECKED_IN"
                        ? t("qr.mode_checkout")
                        : t("qr.scan_for_shift")}
                    </Button>
                  </Link>
                </div>
              )}
          </div>
        ) : (
          <>
            {shift.requirements_ack && (
              <label className="flex items-start gap-2.5 rounded-xl bg-background px-3 py-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-foreground-secondary leading-snug">
                  {t("apply.ack_checkbox")}
                </span>
              </label>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={handleApply}
              loading={applying}
              disabled={!!shift.requirements_ack && !acknowledged}
            >
              {t("apply.button")}
            </Button>
            <p className="text-xs text-foreground-tertiary text-center">
              {t("apply.not_commitment")}
            </p>
          </>
        )}
        {applyMsg && (
          <p className={`text-sm mt-2 text-center animate-fade-in ${shift.my_application ? "text-success" : "text-danger"}`}>{applyMsg}</p>
        )}
        {overlapShiftId && (
          <Link
            href={`/shifts/${overlapShiftId}`}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-warning/10 px-3 py-2.5 text-sm font-semibold text-warning transition-all duration-150 active:scale-[0.98]"
          >
            <AlertTriangle className="h-4 w-4" />
            {t("apply.overlap_title")} · {t("apply.overlap_cta")}
          </Link>
        )}
      </div>
    </div>
  );
}
