"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
import { QrCode, CheckCircle2, XCircle, ScanLine } from "lucide-react";

export default function ScanPage() {
  const { token } = useAuth();
  const [manualToken, setManualToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

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
      if (res.ok) setManualToken("");
    } catch {
      setResult({ ok: false, message: t("error.generic") });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">{t("qr.scan_title")}</h1>

      {result ? (
        <div className="text-center py-10 space-y-3">
          {result.ok ? (
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
          ) : (
            <XCircle className="h-10 w-10 text-danger mx-auto" />
          )}
          <div>
            <p className="font-semibold text-foreground text-lg">
              {result.ok ? t("qr.success_title") : t("qr.error_title")}
            </p>
            <p className="text-sm text-foreground-secondary mt-1">{result.message}</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setResult(null)}>
            {t("qr.scan_again")}
          </Button>
        </div>
      ) : (
        <div className="space-y-5 pt-4">
          <div className="text-center space-y-2">
            <ScanLine className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm text-foreground-secondary max-w-xs mx-auto">
              {t("qr.scan_intro")}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
              <QrCode className="h-4 w-4 text-foreground-tertiary shrink-0" />
              <input
                type="text"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none"
                placeholder={t("qr.placeholder")}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => handleScan(manualToken)}
              loading={scanning}
              disabled={!manualToken.trim()}
            >
              {t("qr.scan")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
