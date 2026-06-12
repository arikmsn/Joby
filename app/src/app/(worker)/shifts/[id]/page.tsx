"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Clock,
  Banknote,
  Users,
  Shirt,
  Wrench,
  Navigation,
  Phone,
  User,
  ArrowRight,
  CheckCircle2,
  Info,
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
      <p className="text-center py-8 text-danger">
        {error || t("error.shift_not_found")}
      </p>
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

  const spotsLeft = shift.workers_needed - shift.slots_filled;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-foreground-secondary hover:text-foreground transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        {t("general.back")}
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-foreground">{shift.title}</h1>
          <Badge variant="secondary">{shift.role_tag}</Badge>
        </div>
        <p className="text-foreground-secondary">{shift.business_name}</p>
      </div>

      {/* Key details */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <Clock className="h-4 w-4 text-foreground-tertiary shrink-0" />
          <div>
            <div className="text-foreground">
              {fmt(shift.start_at)} — {fmt(shift.end_at)}
            </div>
            <div className="text-foreground-secondary">
              {duration(shift.start_at, shift.end_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
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
        <div className="flex items-center gap-3 text-sm">
          <Banknote className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-foreground">
            {t("general.currency")}
            {shift.pay_rate}{" "}
            <span className="font-normal text-foreground-secondary">
              {shift.pay_type === "hourly"
                ? t("shift.per_hour")
                : t("shift.total")}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Users className="h-4 w-4 text-foreground-tertiary shrink-0" />
          <span className="text-foreground">
            {shift.slots_filled}/{shift.workers_needed}
            {" — "}
            <span
              className={
                spotsLeft > 0
                  ? "text-success font-medium"
                  : "text-danger font-medium"
              }
            >
              {spotsLeft > 0 ? `${spotsLeft} מקומות פנויים` : "מלא"}
            </span>
          </span>
        </div>
      </div>

      {/* Description */}
      {shift.description && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <h3 className="font-semibold text-foreground mb-2">
            {t("shift.description")}
          </h3>
          <p className="text-sm text-foreground-secondary whitespace-pre-line">
            {shift.description}
          </p>
        </div>
      )}

      {/* Requirements */}
      {(shift.dress_code || shift.gear_required || shift.arrival_notes) && (
        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
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
        <div className="bg-surface rounded-xl border border-border p-4 space-y-2">
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

      {/* Why am I seeing this */}
      <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("shift.why_shown")}
          </p>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {t("shift.why_shown_text")}
          </p>
        </div>
      </div>

      {/* Apply section */}
      <div className="sticky bottom-20 bg-surface rounded-xl border border-border p-4 shadow-float space-y-2">
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
