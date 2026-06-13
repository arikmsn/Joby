"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Plus } from "lucide-react";

interface Occupation {
  id: string;
  key: string;
  label_he: string;
  sort_order: number;
  is_active: boolean;
}

export default function AdminCatalogPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Occupation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [labelEdits, setLabelEdits] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState("");

  function load() {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/occupations", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const occs: Occupation[] = d.occupations || [];
        setRows(occs);
        const edits: Record<string, string> = {};
        occs.forEach((o) => (edits[o.id] = o.label_he));
        setLabelEdits(edits);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function patchOccupation(id: string, body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/occupations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!newKey.trim() || !newLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/occupations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: newKey.trim(), label_he: newLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      setNewKey("");
      setNewLabel("");
      load();
    } finally {
      setSaving(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = rows[index + direction];
    const current = rows[index];
    if (!target || !current) return;
    patchOccupation(current.id, { sort_order: target.sort_order });
    patchOccupation(target.id, { sort_order: current.sort_order });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{t("nav.catalog")}</h1>

      <Card className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Input label={t("admin.catalog.key")} dir="ltr" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. waiter" />
          <Input label={t("admin.catalog.label")} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Button size="sm" onClick={handleAdd} loading={saving} disabled={!newKey.trim() || !newLabel.trim()}>
            <Plus className="h-4 w-4" />
            {t("admin.catalog.add")}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((occ, idx) => (
            <Card key={occ.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0 || saving}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1 || saving}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant="muted" className="font-mono" dir="ltr">{occ.key}</Badge>
              <input
                className="flex-1 min-w-[160px] rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                value={labelEdits[occ.id] ?? occ.label_he}
                onChange={(e) => setLabelEdits((prev) => ({ ...prev, [occ.id]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => patchOccupation(occ.id, { label_he: labelEdits[occ.id] })}
                loading={saving}
                disabled={labelEdits[occ.id] === occ.label_he}
              >
                {t("general.save")}
              </Button>
              <Badge variant={occ.is_active ? "success" : "muted"}>
                {occ.is_active ? t("admin.common.active") : t("admin.common.inactive")}
              </Badge>
              <Button
                size="sm"
                variant={occ.is_active ? "danger" : "success"}
                onClick={() => patchOccupation(occ.id, { is_active: !occ.is_active })}
                loading={saving}
              >
                {occ.is_active ? t("admin.common.deactivate") : t("admin.common.activate")}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
