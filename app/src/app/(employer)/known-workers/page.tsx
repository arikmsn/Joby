"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrustBadge } from "@/components/ui/trust-badge";
import { Sheet } from "@/components/ui/sheet";
import { Star, Search, Send, Users, UserPlus, MessageCircle } from "lucide-react";
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

interface SearchedWorker {
  id: string;
  full_name: string;
  phone: string;
  city: string | null;
  trust_score: string | null;
  total_shifts: number | null;
  connected: boolean;
}

interface InviteShift {
  id: string;
  title: string;
  start_at: string;
}

interface WorkerInvite {
  id: string;
  invited_phone: string;
  normalized_phone: string;
  status: "PENDING" | "JOINED" | "FAILED";
  sent_at: string;
  joined_at: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

function statusBadge(status: WorkerInvite["status"]) {
  if (status === "JOINED") return <Badge variant="success">{t("known_workers.status_joined")}</Badge>;
  if (status === "FAILED") return <Badge variant="destructive">{t("known_workers.status_failed")}</Badge>;
  return <Badge variant="secondary">{t("known_workers.status_pending")}</Badge>;
}

type SearchResult =
  | { type: "found"; worker: SearchedWorker }
  | { type: "not_found" }
  | null;

export default function KnownWorkersPage() {
  const { token } = useAuth();
  const [workers, setWorkers] = useState<KnownWorker[]>([]);
  const [invites, setInvites] = useState<WorkerInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [inviteTarget, setInviteTarget] = useState<KnownWorker | null>(null);
  const [shifts, setShifts] = useState<InviteShift[]>([]);
  const [selectedShift, setSelectedShift] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult>(null);
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sendingNewInvite, setSendingNewInvite] = useState(false);
  const [newInviteMessage, setNewInviteMessage] = useState("");

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
  }, [token]);

  const fetchInvites = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/employers/known-workers/invites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setInvites(d.invites || []);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchWorkers(), fetchInvites()]);
      setLoading(false);
    })();
  }, [fetchWorkers, fetchInvites]);

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
    setNewInviteMessage("");
    try {
      const res = await fetch(`/api/employers/known-workers/search?phone=${encodeURIComponent(searchPhone)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok && d.worker) {
        setSearchResult({ type: "found", worker: d.worker });
      } else {
        setSearchResult({ type: "not_found" });
      }
    } catch { setSearchResult({ type: "not_found" }); }
    setSearching(false);
  }

  async function connectWorker(worker: SearchedWorker) {
    if (!token) return;
    setConnecting(true);
    try {
      const res = await fetch(`/api/employers/known-workers/${worker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_preferred: false }),
      });
      if (res.ok) {
        setSearchResult({ type: "found", worker: { ...worker, connected: true } });
        await fetchWorkers();
      }
    } catch { /* ignore */ }
    setConnecting(false);
  }

  async function sendNewWorkerInvite() {
    if (!token || !searchPhone) return;
    setSendingNewInvite(true);
    setNewInviteMessage("");
    try {
      const res = await fetch("/api/employers/known-workers/invite-new", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: searchPhone }),
      });
      const d = await res.json();
      if (res.ok) {
        setNewInviteMessage(t("known_workers.invite_whatsapp_sent"));
        await fetchInvites();
      } else if (d.error === "WORKER_EXISTS") {
        // Existing worker registered between search and invite — re-run search
        await searchByPhone();
      } else {
        setNewInviteMessage(d.message || t("known_workers.invite_whatsapp_failed"));
      }
    } catch { setNewInviteMessage(t("known_workers.invite_whatsapp_failed")); }
    setSendingNewInvite(false);
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

          {searchResult?.type === "not_found" && (
            <div className="border border-border rounded-xl p-3 space-y-2">
              <div>
                <p className="font-medium text-foreground">{t("known_workers.not_found_title")}</p>
                <p className="text-sm text-foreground-tertiary">{t("known_workers.not_found_sub")}</p>
              </div>
              {newInviteMessage && (
                <p className="text-sm text-info bg-info/10 rounded-lg p-2">{newInviteMessage}</p>
              )}
              <Button size="sm" onClick={sendNewWorkerInvite} loading={sendingNewInvite} className="w-full">
                <MessageCircle className="h-4 w-4 ml-1" />
                {t("known_workers.invite_whatsapp")}
              </Button>
            </div>
          )}

          {searchResult?.type === "found" && (
            <div className="flex items-center justify-between border border-border rounded-xl p-3 gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{searchResult.worker.full_name}</span>
                  {searchResult.worker.trust_score && (
                    <TrustBadge score={searchResult.worker.trust_score} totalShifts={searchResult.worker.total_shifts ?? undefined} />
                  )}
                  {searchResult.worker.connected && <Badge variant="success">{t("known_workers.connected")}</Badge>}
                </div>
                <div className="text-sm text-foreground-tertiary mt-0.5" dir="ltr">
                  {searchResult.worker.phone} {searchResult.worker.city && `· ${searchResult.worker.city}`}
                </div>
              </div>
              {searchResult.worker.connected ? (
                <Button size="sm" variant="secondary" onClick={() => openInvite({
                  worker_id: searchResult.worker.id,
                  full_name: searchResult.worker.full_name,
                  phone: searchResult.worker.phone,
                  city: searchResult.worker.city,
                  trust_score: searchResult.worker.trust_score,
                  total_shifts: searchResult.worker.total_shifts,
                  times_worked: 0,
                  last_worked_at: "",
                  is_preferred: false,
                })}>
                  <Send className="h-4 w-4 ml-1" />
                  {t("known_workers.invite")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => connectWorker(searchResult.worker)} loading={connecting}>
                  <UserPlus className="h-4 w-4 ml-1" />
                  {t("known_workers.add_to_workers")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold text-foreground text-sm mb-2 px-1">{t("known_workers.connected_workers_title")}</h2>
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
                      {w.times_worked > 0 && (
                        <div className="text-sm text-foreground-secondary mt-1">
                          <Badge variant="secondary">{t("known_workers.worked_before")}</Badge>{" "}
                          {w.times_worked === 1
                            ? t("known_workers.worked_times_one")
                            : t("known_workers.worked_times").replace("{count}", String(w.times_worked))}
                          {" · "}
                          {t("known_workers.last_worked").replace("{date}", fmtDate(w.last_worked_at))}
                        </div>
                      )}
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
      </div>

      <div>
        <h2 className="font-semibold text-foreground text-sm mb-2 px-1">{t("known_workers.pending_invites_title")}</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-foreground-tertiary px-1">{t("known_workers.pending_invites_empty")}</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground" dir="ltr">{inv.invited_phone}</div>
                    <div className="text-sm text-foreground-tertiary">
                      {inv.status === "JOINED" && inv.joined_at
                        ? t("known_workers.joined_at").replace("{date}", fmtDate(inv.joined_at))
                        : t("known_workers.sent_at").replace("{date}", fmtDate(inv.sent_at))}
                    </div>
                  </div>
                  {statusBadge(inv.status)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
