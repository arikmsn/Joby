"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Package,
  Play,
} from "lucide-react";

interface ReadinessSummary {
  total_workers: number;
  payout_ready: number;
  not_ready: number;
  ready_workers: { user_id: string; full_name: string }[];
  not_ready_workers: { user_id: string; full_name: string; missing: string[] }[];
}

interface LedgerItem {
  id: string;
  worker_id: string;
  worker_name: string;
  application_id: string;
  gross_amount: number;
  net_amount: number;
  status: string;
  batch_id: string | null;
  created_at: string;
}

interface BatchItem {
  id: string;
  batch_date: string;
  status: string;
  items_count: number;
  total_gross: number;
  total_net: number;
  created_at: string;
}

interface LedgerSummary {
  total_items: number;
  by_status: Record<string, number>;
  total_gross: number;
  total_fees: number;
  total_net: number;
  recent_items: LedgerItem[];
  batches: BatchItem[];
}

interface PayoutData {
  readiness: ReadinessSummary;
  eligible_count: number;
  ledger: LedgerSummary;
}

const MISSING_LABELS: Record<string, string> = {
  legal_name: "שם מלא",
  id_number: "ת.ז.",
  bank_details: "פרטי בנק",
  supplier_type: "סוג ספק",
  tax_id: "מספר עוסק",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "ממתין",
  PAYABLE: "מוכן לתשלום",
  PAYOUT_PENDING: "בתהליך",
  PAID: "שולם",
  PREPARED: "הוכן",
  TRANSFERRED: "הועבר",
  CONFIRMED: "אושר",
};

export default function PayoutsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [prepareResult, setPrepareResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/payouts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handlePrepare() {
    if (!token) return;
    setPreparing(true);
    setPrepareResult(null);
    try {
      const res = await fetch("/api/admin/payouts/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ create_batch: true }),
      });
      const result = await res.json();
      setPrepareResult(result.message);
      fetchData();
    } finally {
      setPreparing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-foreground-secondary text-center py-12">{t("error.generic")}</p>;
  }

  const { readiness, eligible_count, ledger } = data;
  const currency = t("general.currency");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-bold text-foreground">{t("admin.payouts.title")}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="text-center space-y-1">
          <Users className="h-5 w-5 text-primary mx-auto" />
          <div className="text-2xl font-bold text-foreground">{readiness.payout_ready}</div>
          <div className="text-xs text-foreground-secondary">{t("admin.payouts.ready_workers")}</div>
        </Card>
        <Card className="text-center space-y-1">
          <AlertCircle className="h-5 w-5 text-warning mx-auto" />
          <div className="text-2xl font-bold text-foreground">{readiness.not_ready}</div>
          <div className="text-xs text-foreground-secondary">{t("admin.payouts.not_ready_workers")}</div>
        </Card>
        <Card className="text-center space-y-1">
          <FileText className="h-5 w-5 text-success mx-auto" />
          <div className="text-2xl font-bold text-foreground">{eligible_count}</div>
          <div className="text-xs text-foreground-secondary">{t("admin.payouts.eligible_items")}</div>
        </Card>
        <Card className="text-center space-y-1">
          <Wallet className="h-5 w-5 text-foreground-tertiary mx-auto" />
          <div className="text-2xl font-bold text-foreground">{ledger.total_items}</div>
          <div className="text-xs text-foreground-secondary">{t("admin.payouts.ledger_items")}</div>
        </Card>
      </div>

      {/* Prepare action */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("admin.payouts.prepare_title")}</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">
              {t("admin.payouts.prepare_subtitle")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handlePrepare}
            loading={preparing}
            disabled={eligible_count === 0}
          >
            <Play className="h-4 w-4 ml-1" />
            {t("admin.payouts.prepare_action")}
          </Button>
        </div>
        {prepareResult && (
          <div className="text-sm text-success bg-success/10 rounded-lg p-2.5">
            {prepareResult}
          </div>
        )}
        {eligible_count === 0 && (
          <p className="text-xs text-foreground-tertiary">{t("admin.payouts.no_eligible")}</p>
        )}
      </Card>

      {/* Batches */}
      {ledger.batches.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-foreground-tertiary" />
            <h2 className="text-sm font-bold text-foreground">{t("admin.payouts.batches_title")}</h2>
          </div>
          <div className="space-y-2">
            {ledger.batches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between flex-wrap gap-2 rounded-lg bg-background p-3 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">
                    {new Date(batch.batch_date).toLocaleDateString("he-IL")}
                  </div>
                  <div className="text-xs text-foreground-secondary">
                    {batch.items_count} {t("admin.payouts.items")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-medium" dir="ltr">
                    {currency}{batch.total_net.toFixed(0)}
                  </span>
                  <Badge variant={batch.status === "PREPARED" ? "warning" : "success"}>
                    {STATUS_LABELS[batch.status] || batch.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ledger items */}
      {ledger.recent_items.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-foreground-tertiary" />
            <h2 className="text-sm font-bold text-foreground">
              {t("admin.payouts.ledger_title")} ({ledger.total_items})
            </h2>
          </div>
          {Object.keys(ledger.by_status).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(ledger.by_status).map(([status, count]) => (
                <Badge key={status} variant="secondary">
                  {STATUS_LABELS[status] || status}: {count}
                </Badge>
              ))}
            </div>
          )}
          <div className="text-sm text-foreground-secondary flex gap-4 flex-wrap">
            <span>{t("admin.payouts.total_gross")}: {currency}{ledger.total_gross.toFixed(2)}</span>
            <span>{t("admin.payouts.total_fees")}: {currency}{ledger.total_fees.toFixed(2)}</span>
            <span>{t("admin.payouts.total_net")}: {currency}{ledger.total_net.toFixed(2)}</span>
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {ledger.recent_items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 rounded-lg bg-background p-2.5 text-sm"
              >
                <div className="font-medium text-foreground min-w-0 truncate">{item.worker_name}</div>
                <div className="flex items-center gap-2">
                  <span dir="ltr" className="text-foreground-secondary">
                    {currency}{item.net_amount.toFixed(2)}
                  </span>
                  <Badge variant={item.status === "PENDING" ? "secondary" : item.status === "PAID" ? "success" : "warning"}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Worker readiness */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-foreground-tertiary" />
          <h2 className="text-sm font-bold text-foreground">{t("admin.payouts.readiness_title")}</h2>
        </div>

        {readiness.ready_workers.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-success mb-1.5 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("admin.payouts.ready_section")} ({readiness.payout_ready})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {readiness.ready_workers.map((w) => (
                <Badge key={w.user_id} variant="success">{w.full_name}</Badge>
              ))}
            </div>
          </div>
        )}

        {readiness.not_ready_workers.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-warning mb-1.5 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("admin.payouts.not_ready_section")} ({readiness.not_ready})
            </h3>
            <div className="space-y-1.5">
              {readiness.not_ready_workers.map((w) => (
                <div key={w.user_id} className="flex items-center justify-between flex-wrap gap-1 rounded-lg bg-background p-2 text-sm">
                  <span className="font-medium text-foreground">{w.full_name}</span>
                  <div className="flex flex-wrap gap-1">
                    {w.missing.map((m) => (
                      <Badge key={m} variant="warning">{MISSING_LABELS[m] || m}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <p className="text-xs text-foreground-tertiary text-center">
        {t("admin.payouts.disclaimer")}
      </p>
    </div>
  );
}
