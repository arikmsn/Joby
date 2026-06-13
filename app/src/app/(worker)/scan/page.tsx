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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("qr.scan_title")}</h1>
      </div>

      {result ? (
        <div className="bg-surface rounded-2xl border border-border p-6 text-center space-y-4">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              result.ok ? "bg-success/10" : "bg-danger/10"
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="h-8 w-8 text-success" />
            ) : (
              <XCircle className="h-8 w-8 text-danger" />
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {result.ok ? t("qr.success_title") : t("qr.error_title")}
            </p>
            <p className="text-sm text-foreground-secondary mt-1">{result.message}</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setResult(null)}>
            {t("qr.scan_again")}
          </Button>
        </div>
      ) : (
        <div className="hero-gradient rounded-2xl p-6 text-center text-white shadow-card relative overflow-hidden">
          <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
              <ScanLine className="h-8 w-8 text-white" />
            </div>
            <p className="text-sm text-white/85 max-w-xs mx-auto">
              {t("qr.scan_intro")}
            </p>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2.5">
                <QrCode className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <input
                  type="text"
                  dir="ltr"
                  className="w-full bg-transparent text-sm text-left font-mono text-foreground placeholder:text-foreground-tertiary focus:outline-none"
                  placeholder={t("qr.placeholder")}
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                />
              </div>
              <Button
                className="w-full bg-white text-primary hover:bg-white/90 shadow-none"
                onClick={() => handleScan(manualToken)}
                loading={scanning}
                disabled={!manualToken.trim()}
              >
                {t("qr.scan")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
