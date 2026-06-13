"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useDocumentTitle } from "@/lib/use-document-title";
import { t } from "@/lib/i18n/he";
import Link from "next/link";
import { Building2, User } from "lucide-react";
import { JobyMark } from "@/components/ui/joby-mark";
import { roleHomePath, type AuthRole } from "@/lib/auth-routes";

export function RegisterForm({ forcedRole }: { forcedRole?: AuthRole }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-foreground-secondary">{t("general.loading")}</p>
        </div>
      }
    >
      <RegisterFormInner forcedRole={forcedRole} />
    </Suspense>
  );
}

function RegisterFormInner({ forcedRole }: { forcedRole?: AuthRole }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, isLoading } = useAuth();
  const initialPhone = searchParams.get("phone") || "";
  const [role, setRole] = useState<AuthRole | null>(forcedRole ?? null);
  const [phone, setPhone] = useState(initialPhone);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [experienceTags, setExperienceTags] = useState("");

  // Already-logged-in users visiting an auth page go straight to their system.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(roleHomePath(user.role));
    }
  }, [isLoading, user, router]);

  async function handleRegister() {
    if (!role || !fullName || !phone) return;
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        phone,
        full_name: fullName,
        role,
      };
      if (role === "employer") {
        body.business_name = businessName;
        body.business_type = businessType || undefined;
        body.address = address || undefined;
      } else {
        body.city = city || undefined;
        body.experience_tags = experienceTags
          ? experienceTags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      login(data.token, data.user, data.profile);
      router.push(roleHomePath(role));
    } catch {
      setError(t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  const title =
    forcedRole === "worker"
      ? t("auth.worker.join_title")
      : forcedRole === "employer"
        ? t("auth.employer.join_title")
        : t("auth.register");

  useDocumentTitle(title);

  if (isLoading || user) {
    return (
      <div className="text-center py-10">
        <p className="text-foreground-secondary">{t("general.loading")}</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <JobyMark className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("auth.register")}
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            {t("auth.register_as")}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setRole("worker")}
            className="w-full flex items-center gap-4 p-4 bg-surface rounded-xl border border-border hover:border-primary hover:shadow-card-hover transition-all text-right"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{t("auth.worker")}</div>
              <div className="text-sm text-foreground-secondary">מצא משמרות והתחל לעבוד</div>
            </div>
          </button>

          <button
            onClick={() => setRole("employer")}
            className="w-full flex items-center gap-4 p-4 bg-surface rounded-xl border border-border hover:border-primary hover:shadow-card-hover transition-all text-right"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{t("auth.employer")}</div>
              <div className="text-sm text-foreground-secondary">צור משמרות וגייס עובדים</div>
            </div>
          </button>
        </div>

        <p className="text-center text-sm text-foreground-secondary">
          {t("auth.already_registered")}{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    );
  }

  const tagline =
    forcedRole === "worker"
      ? t("auth.worker.join_tagline")
      : forcedRole === "employer"
        ? t("auth.employer.join_tagline")
        : null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {tagline && (
          <p className="text-sm text-foreground-secondary mt-1">{tagline}</p>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 shadow-card space-y-4">
        {!initialPhone && (
          <Input
            id="phone"
            label={t("auth.phone")}
            placeholder={t("auth.phone.placeholder")}
            type="tel"
            dir="ltr"
            className="text-left"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
        <Input
          id="full_name"
          label={t("auth.full_name")}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        {role === "employer" ? (
          <>
            <Input
              id="business_name"
              label={t("auth.business_name")}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <Input
              id="business_type"
              label={t("auth.business_type")}
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
            <Input
              id="address"
              label={t("auth.address")}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </>
        ) : (
          <>
            <Input
              id="city"
              label={t("auth.city")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              id="experience_tags"
              label={t("auth.experience_tags")}
              value={experienceTags}
              onChange={(e) => setExperienceTags(e.target.value)}
            />
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          className="w-full"
          size="lg"
          onClick={handleRegister}
          loading={loading}
          disabled={
            !fullName || !phone || (role === "employer" && !businessName)
          }
        >
          {t("auth.submit")}
        </Button>
      </div>

      {!forcedRole && (
        <button
          onClick={() => setRole(null)}
          className="w-full text-center text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          {t("general.back")}
        </button>
      )}

      <p className="text-center text-sm text-foreground-secondary">
        {t("auth.already_registered")}{" "}
        <Link
          href={forcedRole ? `/login/${forcedRole}` : "/login"}
          className="text-primary font-medium hover:underline"
        >
          {t("auth.login")}
        </Link>
      </p>
    </div>
  );
}
