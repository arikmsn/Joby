"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, MapPin, Phone, FileText, Pencil } from "lucide-react";
import type { EmployerProfile } from "@/lib/types";
import { ISRAEL_CITIES } from "@/lib/constants";

const fieldClass =
  "w-full rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2.5 text-sm transition-colors duration-150 hover:border-foreground-tertiary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

export default function EmployerProfilePage() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch("/api/employers/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          syncFields(data.profile);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  function syncFields(p: EmployerProfile) {
    setBusinessName(p.business_name || "");
    setBusinessType(p.business_type || "");
    setAddress(p.address || "");
    setCity(p.city || "");
    setContactPhone(p.contact_phone || "");
    setDescription(p.description || "");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/employers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_name: businessName,
          business_type: businessType || null,
          address: address || null,
          city: city || null,
          contact_phone: contactPhone || null,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        setProfile(data.profile);
        syncFields(data.profile);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">{t("employer_profile.title")}</h1>
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-3 pt-2 border-t border-border-light">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">{t("employer_profile.title")}</h1>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground truncate">
              {profile?.business_name || "—"}
            </h2>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-full p-1 text-foreground-tertiary transition-all duration-150 hover:bg-background hover:text-primary active:scale-90 shrink-0"
              aria-label={t("general.edit")}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-4 pt-2 border-t border-border-light">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("employer_profile.business_name")}
              </label>
              <input
                type="text"
                className={fieldClass}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("employer_profile.business_type")}
              </label>
              <input
                type="text"
                className={fieldClass}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("employer_profile.city")}
              </label>
              <select
                className={fieldClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">{t("feed.all_cities")}</option>
                {ISRAEL_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("employer_profile.address")}
              </label>
              <input
                type="text"
                className={fieldClass}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("employer_profile.contact_phone")}
              </label>
              <input
                type="tel"
                dir="ltr"
                className={cn(fieldClass, "text-center")}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("employer_profile.description")}
              </label>
              <textarea
                className={cn(fieldClass, "resize-none")}
                rows={4}
                maxLength={1000}
                placeholder={t("employer_profile.description_placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} loading={saving}>
                {t("general.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (profile) syncFields(profile);
                  setEditing(false);
                }}
              >
                {t("general.cancel")}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-3 pt-2 border-t border-border-light text-sm"
          >
            {!profile?.business_type &&
              !profile?.city &&
              !profile?.address &&
              !profile?.contact_phone &&
              !profile?.description && (
                <p className="text-foreground-tertiary">{t("employer_profile.no_details")}</p>
              )}
            {profile?.business_type && (
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Building2 className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>{profile.business_type}</span>
              </div>
            )}
            {(profile?.city || profile?.address) && (
              <div className="flex items-center gap-2 text-foreground-secondary">
                <MapPin className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>{[profile?.address, profile?.city].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {profile?.contact_phone && (
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Phone className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span dir="ltr">{profile.contact_phone}</span>
              </div>
            )}
            {profile?.description && (
              <div className="flex items-start gap-2 text-foreground-secondary pt-1 border-t border-border-light">
                <FileText className="h-4 w-4 text-foreground-tertiary shrink-0 mt-0.5" />
                <p>{profile.description}</p>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
