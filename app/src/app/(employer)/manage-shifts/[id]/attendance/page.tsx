"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrustBadge } from "@/components/ui/trust-badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AttendanceRecord {
  application_id: string;
  worker_id: string;
  worker_name: string;
  worker_phone: string;
  worker_trust: string | null;
  worker_total_shifts: number | null;
  status: string;
  is_backup: boolean;
  checked_in_at: string | null;
  checked_in_source: string | null;
  checked_out_at: string | null;
  checked_out_source: string | null;
}

interface ShiftInfo {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
}

type QrMode = "CHECK_IN" | "CHECK_OUT";

export default function AttendancePage() {
  const params = useParams();
  const shiftId = params.id as string;
  const { token } = useAuth();
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosMessage, setSosMessage] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [qrMode, setQrMode] = useState<QrMode>("CHECK_IN");

  const fetchAttendance = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/shifts/${shiftId}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setShift(d.shift);
        setRecords(d.attendance || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, shiftId]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);
  useEffect(() => {
    const interval = setInterval(fetchAttendance, 15000);
    return () => clearInterval(interval);
  }, [fetchAttendance]);

  async function generateQr(mode: QrMode) {
    if (!token) return;
    setQrMode(mode);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/qr?mode=${mode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setQrToken(d.token || "");
    } catch { setQrToken(""); }
  }

  async function manualAction(appId: string, action: "checkin" | "checkout") {
    setActionId(appId);
    try {
      await fetch(`/api/applications/${appId}/manual-${action}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAttendance();
    } catch { /* ignore */ }
    setActionId(null);
  }

  async function promoteBackup(appId: string) {
    setActionId(appId);
    try {
      const res = await fetch(`/api/applications/${appId}/promote-backup`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) alert(d.message || "Error");
      await fetchAttendance();
    } catch { /* ignore */ }
    setActionId(null);
  }

  async function triggerSos() {
    setSosLoading(true);
    setSosMessage("");
    try {
      const res = await fetch(`/api/shifts/${shiftId}/sos`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setSosMessage(d.message || (res.ok ? t("sos.success") : "Error"));
    } catch { setSosMessage(t("error.generic")); }
    setSosLoading(false);
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "muted" }> = {
      APPROVED: { label: t("attendance.status.approved"), variant: "warning" },
      CONFIRMED: { label: t("attendance.status.confirmed"), variant: "default" },
      CHECKED_IN: { label: t("attendance.status.checked_in"), variant: "success" },
      CHECKED_OUT: { label: t("attendance.status.checked_out"), variant: "muted" },
      NO_SHOW: { label: t("attendance.status.missing"), variant: "danger" },
    };
    const m = map[status] || { label: status, variant: "muted" as const };
    return <Badge variant={m.variant}>{m.label}</Badge>;
  }

  function fmtTime(iso: string | null) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) return <p className="text-center py-8 text-foreground-tertiary">{t("general.loading")}</p>;

  const activeRecords = records.filter((r) => !r.is_backup);
  const backupRecords = records.filter((r) => r.is_backup);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("attendance.title")}</h1>
          {shift && <p className="text-foreground-secondary">{shift.title}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/manage-shifts/${shiftId}/rate`}>
            <Button variant="secondary" size="sm">{t("rating.title")}</Button>
          </Link>
          <Button variant="danger" size="sm" onClick={triggerSos} loading={sosLoading}>
            {t("sos.trigger")}
          </Button>
          <Link href={`/manage-shifts/${shiftId}/edit`}>
            <Button variant="ghost" size="sm">{t("general.back")}</Button>
          </Link>
        </div>
      </div>

      {sosMessage && (
        <p className="text-sm text-center text-info bg-info/10 rounded-lg p-2">{sosMessage}</p>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-sm text-foreground">{t("qr.generate")}:</span>
            <Button size="sm" onClick={() => generateQr("CHECK_IN")}>{t("qr.mode_checkin")}</Button>
            <Button size="sm" variant="secondary" onClick={() => generateQr("CHECK_OUT")}>{t("qr.mode_checkout")}</Button>
          </div>
          {qrToken && (
            <div className="mt-3 p-3 bg-background rounded-lg">
              <p className="text-xs text-foreground-tertiary mb-1">
                {qrMode === "CHECK_IN" ? t("qr.mode_checkin") : t("qr.mode_checkout")} — QR Token:
              </p>
              <p className="font-mono text-xs break-all select-all text-foreground" dir="ltr">{qrToken}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold text-foreground mb-3">{t("applicants.title")}</h2>
          {activeRecords.length === 0 ? (
            <p className="text-center text-foreground-tertiary py-4">{t("applicants.no_applicants")}</p>
          ) : (
            <div className="space-y-3">
              {activeRecords.map((rec) => (
                <div key={rec.application_id} className="flex items-center justify-between border border-border rounded-xl p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/workers/${rec.worker_id}`} className="font-medium text-primary hover:underline">{rec.worker_name}</Link>
                      {statusBadge(rec.status)}
                      <TrustBadge score={rec.worker_trust} totalShifts={rec.worker_total_shifts ?? undefined} />
                    </div>
                    <div className="text-sm text-foreground-tertiary mt-0.5">
                      {rec.worker_phone}
                      {rec.checked_in_at && ` · כניסה: ${fmtTime(rec.checked_in_at)}`}
                      {rec.checked_out_at && ` · יציאה: ${fmtTime(rec.checked_out_at)}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(rec.status === "APPROVED" || rec.status === "CONFIRMED") && (
                      <Button size="sm" onClick={() => manualAction(rec.application_id, "checkin")} loading={actionId === rec.application_id}>
                        {t("attendance.manual_checkin")}
                      </Button>
                    )}
                    {rec.status === "CHECKED_IN" && (
                      <Button size="sm" variant="secondary" onClick={() => manualAction(rec.application_id, "checkout")} loading={actionId === rec.application_id}>
                        {t("attendance.manual_checkout")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {backupRecords.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-3">{t("backup.section_title")}</h2>
            <div className="space-y-3">
              {backupRecords.map((rec) => (
                <div key={rec.application_id} className="flex items-center justify-between border border-border rounded-xl p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/workers/${rec.worker_id}`} className="font-medium text-primary hover:underline">{rec.worker_name}</Link>
                      <Badge variant="secondary">{t("applicants.backup")}</Badge>
                      <TrustBadge score={rec.worker_trust} totalShifts={rec.worker_total_shifts ?? undefined} />
                    </div>
                    <div className="text-sm text-foreground-tertiary mt-0.5">{rec.worker_phone}</div>
                  </div>
                  <Button size="sm" onClick={() => promoteBackup(rec.application_id)} loading={actionId === rec.application_id}>
                    {t("backup.promote")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
