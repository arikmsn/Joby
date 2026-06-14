"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrustBadge } from "@/components/ui/trust-badge";
import { Sheet } from "@/components/ui/sheet";
import { Star, Search, Send, Users } from "lucide-react";
import Link from "next/link";

interface KnownWorker {
  worker_id: string;
  full_name: string;
  phone: string;
  city: string | null;
  trust_score: string | null;
  total_shifts: number | null;
  times_worked: number;
  last_worked_at: string;
  is_preferred: boolean;
}

interface InviteShift {
  id: string;
  title: string;
  start_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

export default function KnownWorkersPage() {
  const { token } = useAuth();
  const [workers, setWorkers] = useState<KnownWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [inviteTarget, setInviteTarget] = useState<KnownWorker | null>(null);
  const [shifts, setShifts] = useState<InviteShift[]>([]);
  const [selectedShift, setSelectedShift] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<KnownWorker | "not_found" | null>(null);
  const [searching, setSearching] = useState(false);

  const fetchWorkers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/employers/known-workers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setWorkers(d.workers || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  async function togglePreferred(worker: KnownWorker) {
    if (!token) return;
    setTogglingId(worker.worker_id);
    try {
      const res = await fetch(`/api/employers/known-workers/${worker.worker_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_preferred: !worker.is_preferred }),
      });
      if (res.ok) await fetchWorkers();
    } catch { /* ignore */ }
    setTogglingId(null);
  }

  async function openInvite(worker: KnownWorker) {
    setInviteTarget(worker);
    setSelectedShift("");
    setInviteMessage("");
    if (!token) return;
    try {
      const res = await fetch("/api/shifts?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        const published = (d.shifts || []).filter((s: { status: string }) => s.status === "PUBLISHED");
        setShifts(published);
      }
    } catch { setShifts([]); }
  }

  async function sendInvite() {
    if (!token || !inviteTarget || !selectedShift) return;
    setInviting(true);
    setInviteMessage("");
    try {
      const res = await fetch("/api/employers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ worker_id: inviteTarget.worker_id, shift_id: selectedShift }),
      });
      const d = await res.json();
      if (res.ok) {
        setInviteMessage(t("known_workers.invite_sent"));
      } else {
        setInviteMessage(d.message || t("error.generic"));
      }
    } catch { setInviteMessage(t("error.generic")); }
    setInviting(false);
  }

  async function searchByPhone() {
    if (!token || !searchPhone) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/employers/known-workers/search?phone=${encodeURIComponent(searchPhone)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok && d.worker) {
        setSearchResult({
          worker_id: d.worker.id,
          full_name: d.worker.full_name,
          phone: d.worker.phone,
          city: d.worker.city,
          trust_score: d.worker.trust_score,
          total_shifts: d.worker.total_shifts,
          times_worked: 0,
          last_worked_at: "",
          is_preferred: false,
        });
      } else {
        setSearchResult("not_found");
      }
    } catch { setSearchResult("not_found"); }
    setSearching(false);
  }

  if (loading) return <p className="text-center py-8 text-foreground-tertiary">{t("general.loading")}</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("known_workers.title")}</h1>
        <p className="text-sm text-foreground-secondary mt-0.5">{t("known_workers.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <h2 className="font-semibold text-foreground text-sm">{t("known_workers.search_phone_title")}</h2>
          <div className="flex gap-2">
            <input
              type="tel"
              dir="ltr"
              placeholder={t("known_workers.search_phone_placeholder")}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
            />
            <Button size="sm" onClick={searchByPhone} loading={searching}>
              <Search className="h-4 w-4 ml-1" />
              {t("known_workers.search_button")}
            </Button>
          </div>
          {searchResult === "not_found" && (
            <p className="text-sm text-foreground-tertiary">{t("known_workers.worker_not_found")}</p>
          )}
          {searchResult && searchResult !== "not_found" && (
            <div className="flex items-center justify-between border border-border rounded-xl p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{searchResult.full_name}</span>
                  {searchResult.trust_score && <TrustBadge score={searchResult.trust_score} totalShifts={searchResult.total_shifts ?? undefined} />}
                </div>
                <div className="text-sm text-foreground-tertiary mt-0.5" dir="ltr">{searchResult.phone} {searchResult.city && `· ${searchResult.city}`}</div>
              </div>
              <Button size="sm" onClick={() => openInvite(searchResult as KnownWorker)}>
                <Send className="h-4 w-4 ml-1" />
                {t("known_workers.invite")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {workers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-center py-12 bg-surface rounded-2xl border border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
            <Users className="h-5 w-5 text-foreground-tertiary" />
          </div>
          <p className="text-foreground font-medium">{t("known_workers.empty")}</p>
          <p className="text-sm text-foreground-secondary">{t("known_workers.empty_sub")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((w) => (
            <Card key={w.worker_id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/workers/${w.worker_id}`} className="font-medium text-primary hover:underline">
                        {w.full_name}
                      </Link>
                      {w.is_preferred && <Badge variant="success">{t("known_workers.preferred")}</Badge>}
                      {w.trust_score && <TrustBadge score={w.trust_score} totalShifts={w.total_shifts ?? undefined} />}
                    </div>
                    <div className="text-sm text-foreground-tertiary mt-0.5" dir="ltr">
                      {w.phone} {w.city && `· ${w.city}`}
                    </div>
                    <div className="text-sm text-foreground-secondary mt-1">
                      <Badge variant="secondary">{t("known_workers.worked_before")}</Badge>{" "}
                      {w.times_worked === 1
                        ? t("known_workers.worked_times_one")
                        : t("known_workers.worked_times").replace("{count}", String(w.times_worked))}
                      {" · "}
                      {t("known_workers.last_worked").replace("{date}", fmtDate(w.last_worked_at))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => openInvite(w)}>
                      <Send className="h-4 w-4 ml-1" />
                      {t("known_workers.invite")}
                    </Button>
                    <Button
                      size="sm"
                      variant={w.is_preferred ? "ghost" : "secondary"}
                      onClick={() => togglePreferred(w)}
                      loading={togglingId === w.worker_id}
                    >
                      <Star className="h-4 w-4 ml-1" />
                      {w.is_preferred ? t("known_workers.unmark_preferred") : t("known_workers.mark_preferred")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!inviteTarget} onClose={() => setInviteTarget(null)} title={t("known_workers.invite_title")}>
        {inviteTarget && (
          <div className="space-y-3 pb-2">
            <p className="text-sm text-foreground-secondary">{inviteTarget.full_name}</p>
            {shifts.length === 0 ? (
              <p className="text-sm text-foreground-tertiary py-4 text-center">{t("known_workers.no_shifts_to_invite")}</p>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{t("known_workers.select_shift")}</label>
                  <select
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                  >
                    <option value="" disabled>{t("known_workers.select_shift")}</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} · {fmtDate(s.start_at)}
                      </option>
                    ))}
                  </select>
                </div>
                {inviteMessage && <p className="text-sm text-info bg-info/10 rounded-lg p-2">{inviteMessage}</p>}
                <Button onClick={sendInvite} loading={inviting} disabled={!selectedShift} className="w-full">
                  {t("known_workers.invite_send")}
                </Button>
              </>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
