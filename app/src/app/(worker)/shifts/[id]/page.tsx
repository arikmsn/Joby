"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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
  employer_name: string;
  business_name: string;
  has_sos?: boolean;
}

export default function ShiftDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const shiftId = params.id as string;
  const { token } = useAuth();
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");

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
    try {
      const res = await fetch(`/api/shifts/${shiftId}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setApplied(true);
        setApplyMsg(data.message || t("apply.success"));
      } else {
        setApplyMsg(data.message || t("error.generic"));
        if (res.status === 409 && data.error === "DUPLICATE") setApplied(true);
      }
    } catch {
      setApplyMsg(t("error.generic"));
    } finally {
      setApplying(false);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (error || !shift)
    return (
      <div className="text-center py-20 px-4">
        <p className="font-semibold text-foreground">
          {error || t("error.shift_not_found")}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-full bg-primary/10 text-primary text-sm font-semibold px-4 py-2 hover:bg-primary/20 transition-colors"
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

  const spotsLeft = shift.workers_needed - shift.slots_filled;

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-foreground-secondary hover:text-foreground transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        {t("general.back")}
      </button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {shift.role_tag}
          </span>
          {shift.has_sos && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
              <AlertTriangle className="h-3 w-3" />
              {t("sos.badge")}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground leading-snug">{shift.title}</h1>
        <p className="text-foreground-secondary text-sm">
          <span className="font-medium text-foreground">{shift.business_name}</span>
          {" · "}
          {t("shift.employer_verified")}
        </p>

        <div className="flex items-end justify-between pt-3 border-t border-border-light">
          <div>
            <div className="text-3xl font-bold text-foreground" dir="ltr">
              {t("general.currency")}{formatPay(shift.pay_rate)}
            </div>
            <div className="text-sm text-foreground-tertiary mt-0.5">
              {shift.pay_type === "hourly" ? t("shift.per_hour") : t("shift.total")}
            </div>
          </div>
          <div className="text-left">
            <div
              className={`text-sm font-semibold ${
                spotsLeft > 0
                  ? spotsLeft <= 1
                    ? "text-warning"
                    : "text-foreground"
                  : "text-foreground-tertiary"
              }`}
            >
              {spotsLeft > 0
                ? spotsLeft === 1
                  ? t("feed.spots_left_one")
                  : `${spotsLeft} ${t("feed.spots_left")}`
                : t("feed.full")}
            </div>
            <div className="text-xs text-foreground-tertiary mt-0.5">
              {shift.slots_filled}/{shift.workers_needed} {t("shift.slots")}
            </div>
          </div>
        </div>
      </div>

      {/* Key details */}
      <div className="divide-y divide-border-light border-y border-border-light">
        <div className="flex items-center gap-3 py-3 text-sm">
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
        <div className="flex items-center gap-3 py-3 text-sm">
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
      </div>

      {/* Why am I seeing this */}
      <p className="text-xs text-foreground-tertiary leading-relaxed">
        <span className="font-medium text-foreground-secondary">{t("shift.why_shown")}</span>{" "}
        {t("shift.why_shown_text")}
      </p>

      {/* Description */}
      {shift.description && (
        <div className="pt-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary mb-2">
            {t("shift.description")}
          </h3>
          <p className="text-sm text-foreground-secondary whitespace-pre-line leading-relaxed">
            {shift.description}
          </p>
        </div>
      )}

      {/* Requirements */}
      {(shift.dress_code || shift.gear_required || shift.arrival_notes) && (
        <div className="pt-4 border-t border-border-light space-y-3">
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
        </div>
      )}

      {/* Contact */}
      {(shift.contact_name || shift.contact_phone) && (
        <div className="pt-4 border-t border-border-light space-y-2">
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
                className="text-primary hover:underline"
              >
                {shift.contact_phone}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Apply section */}
      <div className="sticky bottom-16 -mx-4 px-4 pt-3 pb-2 bg-background border-t border-border space-y-2">
        {applied ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="font-medium text-success">
              {t("apply.success")}
            </span>
          </div>
        ) : (
          <>
            <Button
              className="w-full"
              size="lg"
              onClick={handleApply}
              loading={applying}
            >
              {t("apply.button")}
            </Button>
            <p className="text-xs text-foreground-tertiary text-center">
              {t("apply.not_commitment")}
            </p>
          </>
        )}
        {applyMsg && !applied && (
          <p className="text-sm text-danger mt-2 text-center">{applyMsg}</p>
        )}
      </div>
    </div>
  );
}
