"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Config } from "@/lib/constants";
import { QrCode, CheckCircle2, XCircle, ScanLine, Clock } from "lucide-react";
import Link from "next/link";

interface ShiftInfo {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  my_application?: { id: string; status: string; is_backup: boolean } | null;
}

export default function ScanPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const shiftId = searchParams.get("shiftId");
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [loadingShift, setLoadingShift] = useState(!!shiftId);
  const [manualToken, setManualToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchShift = async () => {
    if (!shiftId || !token) return;
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setShift(d.shift || null);
      }
    } catch { /* ignore */ }
    setLoadingShift(false);
  };

  useEffect(() => {
    fetchShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId, token]);

  async function handleScan(qrToken: string) {
    if (!token || !qrToken.trim()) return;
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch("/api/checkin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: qrToken.trim() }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message || t("error.generic") });
      if (res.ok) {
        setManualToken("");
        await fetchShift();
      }
    } catch {
      setResult({ ok: false, message: t("error.generic") });
    } finally {
      setScanning(false);
    }
  }

  // Determine eligibility based on the shift's application state (if scanning for a specific shift)
  let gate: { disabled: boolean; reason?: string } | null = null;
  if (shift) {
    const app = shift.my_application;
    const now = new Date();
    const start = new Date(shift.start_at);

    if (!app) {
      gate = { disabled: true, reason: t("qr.not_approved_for_shift") };
    } else if (app.status === "CHECKED_OUT" || app.status === "RATED") {
      gate = { disabled: true, reason: t("qr.already_done") };
    } else if (app.status === "CHECKED_IN") {
      gate = { disabled: false, reason: t("qr.already_checked_in") };
    } else if (app.status === "APPROVED" || app.status === "CONFIRMED") {
      if (app.is_backup) {
        gate = { disabled: true, reason: t("qr.backup_not_allowed") };
      } else {
        const windowStart = new Date(start.getTime() - Config.CHECKIN_WINDOW_BEFORE_MINUTES * 60000);
        if (now < windowStart) {
          gate = { disabled: true, reason: t("qr.window_not_open") };
        } else {
          gate = { disabled: false, reason: t("qr.checkin_open") };
        }
      }
    } else {
      gate = { disabled: true, reason: t("qr.not_approved_for_shift") };
    }
  }

  const isLocked = !!gate?.disabled;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold text-foreground tracking-tight">
        {shift ? t("qr.scan_for_shift") : t("qr.scan_title")}
      </h1>

      {shift && (
        <Card className="p-3">
          <p className="font-medium text-foreground">{shift.title}</p>
        </Card>
      )}

      {result ? (
        <div className="animate-fade-in text-center py-10 space-y-3">
          {result.ok ? (
            <CheckCircle2 className="h-10 w-10 text-success mx-auto animate-pop-in" />
          ) : (
            <XCircle className="h-10 w-10 text-danger mx-auto animate-pop-in" />
          )}
          <div>
            <p className="font-semibold text-foreground text-lg">
              {result.ok ? t("qr.success_title") : t("qr.error_title")}
            </p>
            <p className="text-sm text-foreground-secondary mt-1">{result.message}</p>
          </div>
          {shift ? (
            <Link href={`/shifts/${shift.id}`} className="block">
              <Button variant="secondary" className="w-full">{t("qr.go_to_shift")}</Button>
            </Link>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setResult(null)}>
              {t("qr.scan_again")}
            </Button>
          )}
        </div>
      ) : loadingShift ? (
        <div className="space-y-5 pt-4">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-5 pt-4 animate-fade-in">
          <div className="text-center space-y-2">
            <ScanLine className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm text-foreground-secondary max-w-xs mx-auto">
              {t("qr.scan_intro")}
            </p>
          </div>

          {gate?.reason && (
            <div
              className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                isLocked ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>{gate.reason}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
              <QrCode className="h-4 w-4 text-foreground-tertiary shrink-0" />
              <input
                type="text"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none disabled:opacity-50"
                placeholder={t("qr.placeholder")}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={isLocked}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => handleScan(manualToken)}
              loading={scanning}
              disabled={!manualToken.trim() || isLocked}
            >
              {t("qr.scan")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
