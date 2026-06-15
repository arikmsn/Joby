"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { TimeSelect } from "@/components/ui/time-select";
import { Badge } from "@/components/ui/badge";
import { TrustBadge } from "@/components/ui/trust-badge";
import { Collapsible } from "@/components/ui/collapsible";
import { EmployerAvatar } from "@/components/ui/employer-avatar";
import { StaffingBadges } from "@/components/ui/staffing-summary";
import { History } from "lucide-react";
import { cn } from "@/lib/cn";
import Link from "next/link";

const INACTIVE_APPLICANT_STATUSES = ["REJECTED", "CANCELLED_BY_WORKER", "CANCELLED_BY_SYSTEM", "NO_SHOW"];

function toLocalDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function toLocalTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(11, 16);
}

interface Applicant {
  id: string;
  worker_id: string;
  status: string;
  is_backup: boolean;
  applied_at: string;
  worker_name: string;
  worker_phone: string;
  worker_city: string | null;
  worker_trust: string | null;
  worked_before_count: number;
  recommendation_reasons: string[];
}

export default function EditShiftPage() {
  const router = useRouter();
  const params = useParams();
  const shiftId = params.id as string;
  const { token } = useAuth();
  const { occupations, occupationLabel } = useOccupations();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shift, setShift] = useState<Record<string, unknown> | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", role_tag: "", description: "", location_name: "", city: "", address: "",
    date: "", start_time: "", end_time: "", pay_rate: "", pay_type: "hourly", workers_needed: "1",
    dress_code: "", gear_required: "", arrival_notes: "", contact_name: "", contact_phone: "", requirements_ack: "", min_trust_score: "0",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isOvernight = !!(form.start_time && form.end_time && form.end_time <= form.start_time);

  function computeTimes() {
    const start = new Date(`${form.date}T${form.start_time}`);
    const end = new Date(`${form.date}T${form.end_time}`);
    if (isOvernight) end.setDate(end.getDate() + 1);
    return { start, end };
  }

  const fetchApplicants = useCallback(async () => {
    if (!token || !shiftId) return;
    try {
      const res = await fetch(`/api/shifts/${shiftId}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setApplicants(d.applications || []);
      }
    } catch { /* ignore */ }
  }, [token, shiftId]);

  useEffect(() => {
    if (!token || !shiftId) return;
    fetch(`/api/shifts/${shiftId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const s = d.shift;
        if (!s) { setError(t("error.shift_not_found")); setLoading(false); return; }
        setShift(s);
        setForm({
          title: s.title || "", role_tag: s.role_tag || "", description: s.description || "",
          location_name: s.location_name || "", city: s.city || "", address: s.address || "",
          date: toLocalDate(s.start_at), start_time: toLocalTime(s.start_at), end_time: toLocalTime(s.end_at),
          pay_rate: s.pay_rate || "", pay_type: s.pay_type || "hourly",
          workers_needed: String(s.workers_needed || 1),
          dress_code: s.dress_code || "", gear_required: s.gear_required || "",
          arrival_notes: s.arrival_notes || "", contact_name: s.contact_name || "",
          contact_phone: s.contact_phone || "",
          requirements_ack: s.requirements_ack || "",
          min_trust_score: String(s.min_trust_score || "0"),
        });
        setLoading(false);
      })
      .catch(() => { setError(t("error.generic")); setLoading(false); });
    fetchApplicants();
  }, [token, shiftId, fetchApplicants]);

  const activeApplicants = applicants.filter((a) => !INACTIVE_APPLICANT_STATUSES.includes(a.status));
  const inactiveApplicants = applicants.filter((a) => INACTIVE_APPLICANT_STATUSES.includes(a.status));

  async function saveChanges() {
    setError("");
    if (shift?.status === "DRAFT" && form.start_time === form.end_time) {
      setError(t("shift.end_time_required"));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (shift?.status === "DRAFT") {
        const { start, end } = computeTimes();
        body.title = form.title; body.role_tag = form.role_tag;
        body.address = form.address;
        body.start_at = start.toISOString();
        body.end_at = end.toISOString();
        body.pay_rate = parseFloat(form.pay_rate);
        body.pay_type = form.pay_type;
        body.workers_needed = parseInt(form.workers_needed) || 1;
        body.location_name = form.location_name || undefined;
        body.city = form.city || undefined;
      }
      body.description = form.description || undefined;
      body.dress_code = form.dress_code || undefined;
      body.gear_required = form.gear_required || undefined;
      body.arrival_notes = form.arrival_notes || undefined;
      body.contact_name = form.contact_name || undefined;
      body.contact_phone = form.contact_phone || undefined;
      body.requirements_ack = form.requirements_ack || undefined;
      body.min_trust_score = parseFloat(form.min_trust_score) || 0;

      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || t("error.generic")); return; }
      router.push("/manage-shifts");
    } catch { setError(t("error.generic")); } finally { setSaving(false); }
  }

  async function changeStatus(newStatus: string) {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/shifts/${shiftId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || t("error.generic")); return; }
      setShift(data.shift);
    } catch { setError(t("error.generic")); } finally { setSaving(false); }
  }

  async function handleApplicantAction(appId: string, status: string, isBackup: boolean) {
    setActionLoading(appId);
    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, is_backup: isBackup }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchApplicants();
        const sr = await fetch(`/api/shifts/${shiftId}`, { headers: { Authorization: `Bearer ${token}` } });
        const sd = await sr.json();
        if (sd.shift) setShift(sd.shift);
      } else {
        setError(data.message || t("error.generic"));
      }
    } catch { setError(t("error.generic")); }
    setActionLoading(null);
  }

  if (loading) return <p className="text-center py-8 text-foreground-tertiary">{t("general.loading")}</p>;
  if (!shift) return <p className="text-center py-8 text-danger">{error || t("error.shift_not_found")}</p>;

  const isDraft = shift.status === "DRAFT";
  const isPublished = shift.status === "PUBLISHED";
  const isCancelled = shift.status === "CANCELLED";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("shift.edit")}</h1>
        <Badge variant={isDraft ? "secondary" : isPublished ? "default" : "danger"}>
          {isDraft ? t("shift.status.draft") : isPublished ? t("shift.status.published") : t("shift.status.cancelled")}
        </Badge>
      </div>

      {isPublished && (
        <Link href={`/manage-shifts/${shiftId}/attendance`}>
          <Button variant="secondary" className="w-full">{t("attendance.title")} →</Button>
        </Link>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Input id="title" label={t("shift.title")} value={form.title} onChange={(e) => set("title", e.target.value)} disabled={!isDraft} />
            {isDraft ? (
              <div>
                <label htmlFor="role_tag" className="block text-sm font-medium text-foreground mb-1">{t("shift.role_tag")}</label>
                <select id="role_tag" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" value={form.role_tag} onChange={(e) => set("role_tag", e.target.value)}>
                  <option value="" disabled>{t("shift.role_tag")}</option>
                  {occupations.map((occ) => (
                    <option key={occ.key} value={occ.key}>{occ.label_he}</option>
                  ))}
                  {form.role_tag && !occupations.some((o) => o.key === form.role_tag) && (
                    <option value={form.role_tag}>{form.role_tag}</option>
                  )}
                </select>
              </div>
            ) : (
              <Input id="role_tag" label={t("shift.role_tag")} value={occupationLabel(form.role_tag)} disabled />
            )}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">{t("shift.description")}</label>
              <textarea id="description" className="w-full rounded-lg border border-border px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:bg-background disabled:text-foreground-tertiary" value={form.description} onChange={(e) => set("description", e.target.value)} disabled={isCancelled} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input id="location_name" label={t("shift.location_name")} value={form.location_name} onChange={(e) => set("location_name", e.target.value)} disabled={!isDraft} />
              <Input id="city" label={t("shift.city")} value={form.city} onChange={(e) => set("city", e.target.value)} disabled={!isDraft} />
            </div>
            <Input id="address" label={t("shift.address")} value={form.address} onChange={(e) => set("address", e.target.value)} disabled={!isDraft} />
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-foreground mb-1">{t("shift.date")}</label>
              <input id="date" type="date" className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-background disabled:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" dir="ltr" value={form.date} onChange={(e) => set("date", e.target.value)} disabled={!isDraft} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TimeSelect id="start_time" label={t("shift.start_time")} value={form.start_time} onChange={(e) => set("start_time", e.target.value)} disabled={!isDraft} />
              <TimeSelect id="end_time" label={t("shift.end_time")} value={form.end_time} onChange={(e) => set("end_time", e.target.value)} disabled={!isDraft} />
            </div>
            {isDraft && isOvernight && (
              <p className="text-xs text-info bg-info/10 rounded-lg px-3 py-2">{t("shift.overnight_notice")}</p>
            )}
            {isDraft && form.start_time && form.end_time && form.start_time === form.end_time && (
              <p className="text-xs text-danger">{t("shift.end_time_required")}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input id="pay_rate" label={`${t("shift.pay_rate")} (${t("general.currency")})`} type="number" dir="ltr" value={form.pay_rate} onChange={(e) => set("pay_rate", e.target.value)} disabled={!isDraft} />
              <div>
                <label htmlFor="pay_type" className="block text-sm font-medium text-foreground mb-1">{t("shift.pay_type")}</label>
                <select id="pay_type" className="w-full rounded-lg border border-border px-3 py-2 text-sm disabled:bg-background disabled:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" value={form.pay_type} onChange={(e) => set("pay_type", e.target.value)} disabled={!isDraft}>
                  <option value="hourly">{t("shift.pay_hourly")}</option>
                  <option value="fixed">{t("shift.pay_fixed")}</option>
                </select>
              </div>
              <Input id="workers_needed" label={t("shift.workers_needed")} type="number" dir="ltr" value={form.workers_needed} onChange={(e) => set("workers_needed", e.target.value)} disabled={!isDraft} />
            </div>
            <Input id="dress_code" label={t("shift.dress_code")} value={form.dress_code} onChange={(e) => set("dress_code", e.target.value)} disabled={isCancelled} />
            <Input id="gear_required" label={t("shift.gear_required")} value={form.gear_required} onChange={(e) => set("gear_required", e.target.value)} disabled={isCancelled} />
            <Input id="arrival_notes" label={t("shift.arrival_notes")} value={form.arrival_notes} onChange={(e) => set("arrival_notes", e.target.value)} disabled={isCancelled} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input id="contact_name" label={t("shift.contact_name")} value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} disabled={isCancelled} />
              <Input id="contact_phone" label={t("shift.contact_phone")} type="tel" dir="ltr" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} disabled={isCancelled} />
            </div>

            <div>
              <label htmlFor="requirements_ack" className="block text-sm font-medium text-foreground mb-1">{t("shift.requirements_ack_label")}</label>
              <textarea id="requirements_ack" className="w-full rounded-lg border border-border px-3 py-2 text-sm min-h-[60px] disabled:bg-background disabled:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" placeholder={t("shift.requirements_ack_placeholder")} value={form.requirements_ack} onChange={(e) => set("requirements_ack", e.target.value)} disabled={isCancelled} />
            </div>

            <Input id="min_trust_score" label={t("shift.min_trust")} type="number" dir="ltr" step="0.1" min="0" max="5" value={form.min_trust_score} onChange={(e) => set("min_trust_score", e.target.value)} disabled={isCancelled} />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-3 pt-2">
              {!isCancelled && <Button onClick={saveChanges} loading={saving}>{t("general.save")}</Button>}
              {isDraft && <Button variant="primary" onClick={() => changeStatus("PUBLISHED")} loading={saving}>{t("shift.publish")}</Button>}
              {(isDraft || isPublished) && (
                <Button variant="danger" onClick={() => { if (confirm(t("shift.cancel_confirm"))) changeStatus("CANCELLED"); }} loading={saving}>{t("shift.cancel")}</Button>
              )}
              <Button variant="ghost" onClick={() => router.push("/manage-shifts")}>{t("general.back")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(isPublished || shift.status === "IN_PROGRESS") && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">{t("applicants.title")}</h2>
            </div>
            <div className="mb-4">
              <StaffingBadges
                counts={{
                  workers_needed: shift.workers_needed as number,
                  slots_filled: shift.slots_filled as number,
                  pending_count: activeApplicants.filter((a) => a.status === "PENDING").length,
                  backup_count: activeApplicants.filter((a) => a.status === "APPROVED" && a.is_backup).length,
                }}
                startAt={shift.start_at as string}
              />
            </div>

            {applicants.length === 0 ? (
              <p className="text-sm text-foreground-tertiary text-center py-4">{t("applicants.no_applicants")}</p>
            ) : (
              <>
                {activeApplicants.length === 0 ? (
                  <p className="text-sm text-foreground-tertiary text-center py-4">{t("applicants.no_applicants")}</p>
                ) : (
                  <div className="space-y-3">
                    {activeApplicants.map((app) => (
                      <ApplicantCard
                        key={app.id}
                        app={app}
                        actionLoading={actionLoading}
                        onAction={handleApplicantAction}
                      />
                    ))}
                  </div>
                )}

                {inactiveApplicants.length > 0 && (
                  <Collapsible
                    className="mt-4 pt-3 border-t border-border-light"
                    trigger={`${t("applicants.inactive_title")} (${inactiveApplicants.length})`}
                  >
                    <div className="space-y-3 mt-3">
                      {inactiveApplicants.map((app) => (
                        <ApplicantCard key={app.id} app={app} actionLoading={null} onAction={async () => {}} inactive />
                      ))}
                    </div>
                  </Collapsible>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AppStatusBadge({ status, isBackup }: { status: string; isBackup: boolean }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "muted" }> = {
    PENDING: { label: "ממתין", variant: "warning" },
    APPROVED: { label: isBackup ? "גיבוי" : "מאושר", variant: isBackup ? "secondary" : "success" },
    REJECTED: { label: "נדחה", variant: "danger" },
    CANCELLED_BY_WORKER: { label: "בוטל", variant: "muted" },
    CANCELLED_BY_SYSTEM: { label: "בוטל", variant: "muted" },
  };
   const m = map[status] || { label: status, variant: "muted" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function ApplicantCard({
  app,
  actionLoading,
  onAction,
  inactive,
}: {
  app: Applicant;
  actionLoading: string | null;
  onAction: (appId: string, status: string, isBackup: boolean) => Promise<void>;
  inactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-opacity",
        inactive ? "border-border-light opacity-70 hover:opacity-90" : "border-border"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <EmployerAvatar name={app.worker_name} size="sm" className="mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{app.worker_name}</span>
              <AppStatusBadge status={app.status} isBackup={app.is_backup} />
              {app.worker_trust && <TrustBadge score={app.worker_trust} />}
            </div>
            <div className="text-sm text-foreground-tertiary mt-0.5">
              {app.worker_phone} {app.worker_city && `· ${app.worker_city}`}
            </div>
            {app.worked_before_count > 0 && (
              <div className="mt-1.5">
                <Badge variant="success">
                  <History className="h-3 w-3" />
                  {app.worked_before_count === 1
                    ? t("applicants.worked_before_count_one")
                    : t("applicants.worked_before_count").replace("{count}", String(app.worked_before_count))}
                </Badge>
              </div>
            )}
            {app.recommendation_reasons.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {app.recommendation_reasons.map((reason) => (
                  <span
                    key={reason}
                    className="text-[11px] font-medium text-foreground-secondary bg-background rounded-full px-2 py-0.5 border border-border-light"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {app.status === "PENDING" && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => onAction(app.id, "APPROVED", false)}
              loading={actionLoading === app.id}
            >
              {t("applicants.approve_active")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onAction(app.id, "APPROVED", true)}
              loading={actionLoading === app.id}
            >
              {t("applicants.approve_backup")}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onAction(app.id, "REJECTED", false)}
              loading={actionLoading === app.id}
            >
              {t("applicants.reject")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
