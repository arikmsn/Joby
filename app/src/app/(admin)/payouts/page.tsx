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
  AlertTriangle,
  FileText,
  Package,
  Play,
  ChevronRight,
  ArrowRight,
  Calculator,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────

interface CalculationSnapshot {
  duration_source: "actual" | "scheduled";
  check_in_at: string | null;
  check_out_at: string | null;
  shift_start_at: string;
  shift_end_at: string;
  duration_hours: number;
  pay_type: string;
  pay_rate: number;
  gross_amount: number;
  fee_percent: number;
  platform_fee: number;
  net_amount: number;
  warnings: string[];
}

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
  has_warnings: boolean;
  calculation: CalculationSnapshot | null;
  created_at: string;
}

interface BatchItem {
  id: string;
  batch_date: string;
  status: string;
  items_count: number;
  total_gross: number;
  total_net: number;
  warnings_count: number;
  notes: string | null;
  provider_name: string | null;
  provider_batch_id: string | null;
  provider_status: string | null;
  created_at: string;
}

interface LedgerSummary {
  total_items: number;
  by_status: Record<string, number>;
  total_gross: number;
  total_fees: number;
  total_net: number;
  total_warnings: number;
  recent_items: LedgerItem[];
  batches: BatchItem[];
}

interface PayoutData {
  readiness: ReadinessSummary;
  eligible_count: number;
  ledger: LedgerSummary;
}

interface BatchDetailItem {
  id: string;
  worker_name: string;
  application_id: string;
  shift_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  calculation: CalculationSnapshot | null;
  provider_transfer_id: string | null;
  provider_status: string | null;
  provider_message: string | null;
  created_at: string;
}

interface BatchDetail {
  id: string;
  batch_date: string;
  status: string;
  items_count: number;
  total_gross: number;
  total_fees: number;
  total_net: number;
  warnings_count: number;
  notes: string | null;
  prepared_by_name: string;
  provider_name: string | null;
  provider_batch_id: string | null;
  provider_status: string | null;
  provider_message: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  failed_at: string | null;
  created_at: string;
  items: BatchDetailItem[];
}

// ── Constants ───────────────────────────────────────────────

const MISSING_LABELS: Record<string, string> = {
  legal_name: "שם מלא",
  id_number: "ת.ז.",
  bank_details: "פרטי בנק",
  supplier_type: "סוג ספק",
  tax_id: "מספר עוסק",
};

function statusLabel(status: string): string {
  const key = `admin.payouts.status.${status}` as Parameters<typeof t>[0];
  return t(key) || status;
}

function statusVariant(status: string): "secondary" | "success" | "warning" | "destructive" {
  if (status === "CONFIRMED" || status === "PAID") return "success";
  if (status === "FAILED") return "destructive";
  if (status === "SUBMITTED" || status === "PAYOUT_PENDING" || status === "PARTIALLY_CONFIRMED") return "warning";
  return "secondary";
}

// ── Shared components ───────────────────────────────────────

function WarningBadge({ code }: { code: string }) {
  const label = t(`admin.payouts.warning.${code}` as Parameters<typeof t>[0]) || code;
  return (
    <Badge variant="warning" className="text-[10px]">
      <AlertTriangle className="h-3 w-3 ml-0.5" />
      {label}
    </Badge>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function CalcDetail({ calc }: { calc: CalculationSnapshot }) {
  const currency = t("general.currency");
  return (
    <div className="mt-2 rounded-lg bg-background/50 border border-border p-3 space-y-2 text-xs">
      <div className="flex items-center gap-1.5 text-foreground font-medium">
        <Calculator className="h-3.5 w-3.5" />
        {t("admin.payouts.calc_title")}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-foreground-secondary">
        <span>{t("admin.payouts.duration_source")}:</span>
        <span className="font-medium text-foreground">
          {calc.duration_source === "actual" ? t("admin.payouts.duration_actual") : t("admin.payouts.duration_scheduled")}
        </span>
        <span>{t("admin.payouts.duration_hours")}:</span>
        <span className="font-medium text-foreground">{calc.duration_hours}</span>
        <span>{t("admin.payouts.pay_type")}:</span>
        <span className="font-medium text-foreground">{calc.pay_type === "hourly" ? "שעתי" : "קבוע"}</span>
        <span>{t("admin.payouts.pay_rate")}:</span>
        <span className="font-medium text-foreground" dir="ltr">{currency}{calc.pay_rate}</span>
        <span>{t("admin.payouts.total_gross")}:</span>
        <span className="font-medium text-foreground" dir="ltr">{currency}{calc.gross_amount.toFixed(2)}</span>
        <span>{t("admin.payouts.fee_percent")}:</span>
        <span className="font-medium text-foreground">{calc.fee_percent}%</span>
        <span>{t("admin.payouts.total_fees")}:</span>
        <span className="font-medium text-foreground" dir="ltr">{currency}{calc.platform_fee.toFixed(2)}</span>
        <span>{t("admin.payouts.total_net")}:</span>
        <span className="font-bold text-foreground" dir="ltr">{currency}{calc.net_amount.toFixed(2)}</span>
      </div>
      {(calc.check_in_at || calc.check_out_at) && (
        <div className="pt-1 border-t border-border grid grid-cols-2 gap-x-4 gap-y-1 text-foreground-secondary">
          <span>{t("admin.payouts.check_in")}:</span>
          <span className="text-foreground">{formatTime(calc.check_in_at)}</span>
          <span>{t("admin.payouts.check_out")}:</span>
          <span className="text-foreground">{formatTime(calc.check_out_at)}</span>
          <span>{t("admin.payouts.shift_start")}:</span>
          <span className="text-foreground">{formatTime(calc.shift_start_at)}</span>
          <span>{t("admin.payouts.shift_end")}:</span>
          <span className="text-foreground">{formatTime(calc.shift_end_at)}</span>
        </div>
      )}
      {calc.warnings.length > 0 && (
        <div className="pt-1 border-t border-border flex flex-wrap gap-1">
          {calc.warnings.map((w) => <WarningBadge key={w} code={w} />)}
        </div>
      )}
    </div>
  );
}

function ProviderInfo({ name, batchId, transferId, status, message }: {
  name?: string | null;
  batchId?: string | null;
  transferId?: string | null;
  status?: string | null;
  message?: string | null;
}) {
  const hasAny = name || batchId || transferId || status;
  return (
    <div className="mt-2 rounded-lg bg-background/50 border border-border p-3 space-y-1.5 text-xs">
      <div className="flex items-center gap-1.5 text-foreground font-medium">
        <ExternalLink className="h-3.5 w-3.5" />
        {t("admin.payouts.provider_section")}
      </div>
      {!hasAny ? (
        <div className="text-foreground-tertiary">{t("admin.payouts.provider_none")}</div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-foreground-secondary">
          {name && <><span>{t("admin.payouts.provider_name")}:</span><span className="text-foreground">{name}</span></>}
          {batchId && <><span>{t("admin.payouts.provider_batch_id")}:</span><span className="text-foreground font-mono text-[10px]" dir="ltr">{batchId}</span></>}
          {transferId && <><span>{t("admin.payouts.provider_transfer_id")}:</span><span className="text-foreground font-mono text-[10px]" dir="ltr">{transferId}</span></>}
          {status && <><span>{t("admin.payouts.provider_status")}:</span><span className="text-foreground">{status}</span></>}
          {message && <><span>{t("admin.payouts.provider_message")}:</span><span className="text-foreground">{message}</span></>}
        </div>
      )}
    </div>
  );
}

function TransitionButtons({ entityType, entityId, currentStatus, token, onDone }: {
  entityType: "item" | "batch";
  entityId: string;
  currentStatus: string;
  token: string;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [validTransitions, setValidTransitions] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/admin/payouts/transition?entity_type=${entityType}&status=${currentStatus}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setValidTransitions(d.valid_transitions || []))
      .catch(() => {});
  }, [entityType, currentStatus, token]);

  async function doTransition(targetStatus: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payouts/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          target_status: targetStatus,
          cascade_to_items: entityType === "batch",
        }),
      });
      const result = await res.json();
      if (result.success) onDone();
    } finally {
      setLoading(false);
    }
  }

  if (validTransitions.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border">
      <div className="text-[10px] text-foreground-tertiary mb-1.5 flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" />
        {t("admin.payouts.transition_title")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {validTransitions.map((ts) => (
          <Button
            key={ts}
            size="sm"
            variant={ts === "FAILED" ? "danger" : ts === "CONFIRMED" ? "success" : "ghost"}
            className="text-[11px] h-7 px-2"
            disabled={loading}
            onClick={() => doTransition(ts)}
          >
            <RefreshCw className={`h-3 w-3 ml-1 ${loading ? "animate-spin" : ""}`} />
            {statusLabel(ts)}
            <Badge variant="secondary" className="mr-1 text-[9px] px-1 py-0">{t("admin.payouts.manual_badge")}</Badge>
          </Button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────

export default function PayoutsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [prepareResult, setPrepareResult] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

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

  async function openBatch(batchId: string) {
    if (!token) return;
    setBatchLoading(true);
    setExpandedItem(null);

    try {
      const res = await fetch(`/api/admin/payouts/batch/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBatchDetail(await res.json());
    } finally {
      setBatchLoading(false);
    }
  }

  function refreshBatch() {
    if (batchDetail) openBatch(batchDetail.id);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-foreground-secondary text-center py-12">{t("error.generic")}</p>;
  }

  // ── Batch detail view ─────────────────────────────────────
  if (batchDetail) {
    const currency = t("general.currency");
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setBatchDetail(null); setExpandedItem(null); fetchData(); }}>
            <ArrowRight className="h-4 w-4 ml-1" />
            {t("admin.payouts.back")}
          </Button>
          <h1 className="text-lg font-bold text-foreground">{t("admin.payouts.batch_detail")}</h1>
        </div>

        {/* Batch summary */}
        <Card className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-foreground-secondary text-xs">תאריך</div>
              <div className="font-medium">{new Date(batchDetail.batch_date).toLocaleDateString("he-IL")}</div>
            </div>
            <div>
              <div className="text-foreground-secondary text-xs">{t("admin.payouts.items")}</div>
              <div className="font-medium">{batchDetail.items_count}</div>
            </div>
            <div>
              <div className="text-foreground-secondary text-xs">{t("admin.payouts.total_net")}</div>
              <div className="font-bold" dir="ltr">{currency}{batchDetail.total_net.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-foreground-secondary text-xs">סטטוס</div>
              <Badge variant={statusVariant(batchDetail.status)}>
                {statusLabel(batchDetail.status)}
              </Badge>
            </div>
          </div>

          {batchDetail.warnings_count > 0 && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertTriangle className="h-4 w-4" />
              {batchDetail.warnings_count} {t("admin.payouts.warnings")}
            </div>
          )}

          {/* Lifecycle timestamps */}
          <div className="flex flex-wrap gap-3 text-xs text-foreground-secondary">
            {batchDetail.prepared_by_name && (
              <span>{t("admin.payouts.prepared_by")}: {batchDetail.prepared_by_name}</span>
            )}
            {batchDetail.submitted_at && (
              <span>{t("admin.payouts.submitted_at")}: {formatTime(batchDetail.submitted_at)}</span>
            )}
            {batchDetail.confirmed_at && (
              <span className="text-success">{t("admin.payouts.confirmed_at")}: {formatTime(batchDetail.confirmed_at)}</span>
            )}
            {batchDetail.failed_at && (
              <span className="text-destructive">{t("admin.payouts.failed_at")}: {formatTime(batchDetail.failed_at)}</span>
            )}
          </div>

          {/* Provider info for batch */}
          <ProviderInfo
            name={batchDetail.provider_name}
            batchId={batchDetail.provider_batch_id}
            status={batchDetail.provider_status}
            message={batchDetail.provider_message}
          />

          {batchDetail.notes && (
            <div className="text-xs text-foreground-tertiary bg-background rounded-lg p-2 font-mono" dir="ltr">
              {batchDetail.notes}
            </div>
          )}

          {/* Batch transition controls */}
          {token && (
            <TransitionButtons
              entityType="batch"
              entityId={batchDetail.id}
              currentStatus={batchDetail.status}
              token={token}
              onDone={refreshBatch}
            />
          )}
        </Card>

        {/* Batch items */}
        <Card className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-foreground-tertiary" />
            <h2 className="text-sm font-bold text-foreground">
              {t("admin.payouts.ledger_title")} ({batchDetail.items.length})
            </h2>
          </div>

          <div className="text-sm text-foreground-secondary flex gap-4 flex-wrap mb-2">
            <span>{t("admin.payouts.total_gross")}: {currency}{batchDetail.total_gross.toFixed(2)}</span>
            <span>{t("admin.payouts.total_fees")}: {currency}{batchDetail.total_fees.toFixed(2)}</span>
            <span>{t("admin.payouts.total_net")}: {currency}{batchDetail.total_net.toFixed(2)}</span>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {batchDetail.items.map((item) => (
              <div key={item.id} className="rounded-lg bg-background p-2.5">
                <button
                  className="w-full flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-sm text-right"
                  onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">{item.worker_name}</span>
                    {item.calculation?.warnings?.length ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                    ) : null}
                    {item.provider_transfer_id && (
                      <ExternalLink className="h-3 w-3 text-foreground-tertiary flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="text-foreground-secondary">
                      {currency}{item.net_amount.toFixed(2)}
                    </span>
                    <Badge variant={statusVariant(item.status)}>
                      {statusLabel(item.status)}
                    </Badge>
                    <ChevronRight className={`h-4 w-4 text-foreground-tertiary transition-transform ${expandedItem === item.id ? "rotate-90" : ""}`} />
                  </div>
                </button>

                {expandedItem === item.id && (
                  <div className="space-y-0">
                    {item.calculation && <CalcDetail calc={item.calculation} />}
                    <ProviderInfo
                      transferId={item.provider_transfer_id}
                      status={item.provider_status}
                      message={item.provider_message}
                    />
                    {token && (
                      <TransitionButtons
                        entityType="item"
                        entityId={item.id}
                        currentStatus={item.status}
                        token={token}
                        onDone={refreshBatch}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // ── Main dashboard view ───────────────────────────────────
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

      {/* Warnings summary */}
      {ledger.total_warnings > 0 && (
        <div className="flex items-center gap-2 text-warning text-sm bg-warning/10 rounded-lg p-2.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {ledger.total_warnings} {t("admin.payouts.warnings")} ברשומות קיימות
        </div>
      )}

      {/* Prepare action */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("admin.payouts.prepare_title")}</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">{t("admin.payouts.prepare_subtitle")}</p>
          </div>
          <Button size="sm" onClick={handlePrepare} loading={preparing} disabled={eligible_count === 0}>
            <Play className="h-4 w-4 ml-1" />
            {t("admin.payouts.prepare_action")}
          </Button>
        </div>
        {prepareResult && (
          <div className="text-sm text-success bg-success/10 rounded-lg p-2.5">{prepareResult}</div>
        )}
        {eligible_count === 0 && (
          <p className="text-xs text-foreground-tertiary">{t("admin.payouts.no_eligible")}</p>
        )}
      </Card>

      {/* Batches — clickable */}
      {ledger.batches.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-foreground-tertiary" />
            <h2 className="text-sm font-bold text-foreground">{t("admin.payouts.batches_title")}</h2>
          </div>
          <div className="space-y-2">
            {ledger.batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => openBatch(batch.id)}
                disabled={batchLoading}
                className="w-full flex items-center justify-between flex-wrap gap-2 rounded-lg bg-background p-3 text-sm hover:bg-background/80 transition-colors text-right"
              >
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    {new Date(batch.batch_date).toLocaleDateString("he-IL")}
                    {batch.warnings_count > 0 && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                    {batch.provider_name && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">{batch.provider_name}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-foreground-secondary">
                    {batch.items_count} {t("admin.payouts.items")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-medium" dir="ltr">{currency}{batch.total_net.toFixed(0)}</span>
                  <Badge variant={statusVariant(batch.status)}>{statusLabel(batch.status)}</Badge>
                  <ChevronRight className="h-4 w-4 text-foreground-tertiary" />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Ledger items — expandable */}
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
                <Badge key={status} variant={statusVariant(status)}>
                  {statusLabel(status)}: {count}
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
              <div key={item.id} className="rounded-lg bg-background p-2.5">
                <button
                  className="w-full flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-sm text-right"
                  onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">{item.worker_name}</span>
                    {item.has_warnings && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span dir="ltr" className="text-foreground-secondary">{currency}{item.net_amount.toFixed(2)}</span>
                    <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    <ChevronRight className={`h-4 w-4 text-foreground-tertiary transition-transform ${expandedItem === item.id ? "rotate-90" : ""}`} />
                  </div>
                </button>
                {expandedItem === item.id && item.calculation && (
                  <CalcDetail calc={item.calculation} />
                )}
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

      <p className="text-xs text-foreground-tertiary text-center">{t("admin.payouts.disclaimer")}</p>
    </div>
  );
}
