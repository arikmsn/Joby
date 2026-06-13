"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { TrustBadge } from "@/components/ui/trust-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OccupationPicker, type OccupationOption } from "@/components/ui/occupation-picker";
import { User, MapPin, LogOut, Shield, Pencil } from "lucide-react";
import type { WorkerProfile } from "@/lib/types";

export default function ProfilePage() {
  const { user, profile, logout, token, refreshUser } = useAuth();
  const workerProfile = profile as WorkerProfile | null;

  const [occupations, setOccupations] = useState<OccupationOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState<string[]>(workerProfile?.experience_tags || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/occupations")
      .then((res) => res.json())
      .then((data) => setOccupations(data.occupations || []))
      .catch(() => setOccupations([]));
  }, []);

  useEffect(() => {
    setTags(workerProfile?.experience_tags || []);
  }, [workerProfile?.experience_tags]);

  const labelMap = new Map(occupations.map((o) => [o.key, o.label_he]));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/workers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ experience_tags: tags }),
      });
      if (res.ok) {
        await refreshUser();
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{t("nav.profile")}</h1>

      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {user.full_name}
            </h2>
            <p className="text-sm text-foreground-secondary" dir="ltr">
              {user.phone}
            </p>
          </div>
        </div>

        {workerProfile && (
          <div className="space-y-3 pt-4 border-t border-border">
            {workerProfile.city && (
              <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                <MapPin className="h-4 w-4 text-foreground-tertiary" />
                {workerProfile.city}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-foreground-tertiary" />
              <span className="text-foreground-secondary">{t("trust.score_label")}:</span>
              <TrustBadge
                score={workerProfile.trust_score}
                totalShifts={workerProfile.total_shifts}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="text-center p-3 bg-background rounded-lg">
                <div className="text-lg font-bold text-foreground">
                  {workerProfile.total_shifts || 0}
                </div>
                <div className="text-xs text-foreground-secondary">
                  {t("profile.total_shifts")}
                </div>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <div className="text-lg font-bold text-foreground">
                  {workerProfile.no_show_count || 0}
                </div>
                <div className="text-xs text-foreground-secondary">
                  {t("profile.no_show_count")}
                </div>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <div className="text-lg font-bold text-foreground">
                  {workerProfile.cancel_count || 0}
                </div>
                <div className="text-xs text-foreground-secondary">
                  {t("profile.cancel_count")}
                </div>
              </div>
            </div>

            <div className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("profile.experience")}
                </h3>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-foreground-tertiary hover:text-primary transition-colors"
                    aria-label={t("general.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <OccupationPicker
                    options={occupations}
                    value={tags}
                    onChange={setTags}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} loading={saving}>
                      {t("general.save")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTags(workerProfile.experience_tags || []);
                        setEditing(false);
                      }}
                    >
                      {t("general.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(workerProfile.experience_tags || []).length === 0 ? (
                    <p className="text-sm text-foreground-secondary">
                      {t("profile.no_occupations")}
                    </p>
                  ) : (
                    (workerProfile.experience_tags || []).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {labelMap.get(tag) || tag}
                      </Badge>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        className="w-full text-danger hover:text-danger hover:bg-danger/5"
        onClick={logout}
      >
        <LogOut className="h-4 w-4 ml-2" />
        {t("auth.logout")}
      </Button>
    </div>
  );
}
