"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera } from "lucide-react";

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
    } catch {
      setResult({ ok: false, message: t("error.generic") });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{t("qr.scan_title")}</h1>

      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-foreground-secondary">
            הזן את קוד ה-QR שקיבלת מהמעסיק
          </p>

          <div className="space-y-2">
            <input
              type="text"
              dir="ltr"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-left font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              placeholder="QR token..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => handleScan(manualToken)}
              loading={scanning}
              disabled={!manualToken.trim()}
            >
              {t("qr.scan")}
            </Button>
          </div>

          {result && (
            <Badge variant={result.ok ? "success" : "danger"} className="text-sm px-3 py-1.5">
              {result.message}
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
