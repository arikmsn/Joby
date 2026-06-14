"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Briefcase, ClipboardList, User, Bell, QrCode, Wallet } from "lucide-react";
import { BottomNavLink } from "./nav-link";
import { RoleMismatchBanner } from "./role-mismatch-banner";
import { JobyMark } from "@/components/ui/joby-mark";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { WorkerOnboarding } from "@/components/onboarding/worker-onboarding";
import { OnboardingContext } from "@/components/onboarding/onboarding-context";
import { shouldAutoShowOnboarding } from "@/lib/onboarding";
import type { WorkerProfile } from "@/lib/types";

export function WorkerLayout({ children }: { children: ReactNode }) {
  useDocumentTitle(t("nav.shifts"));
  const { token, profile, isLoading } = useAuth();
  const workerProfile = profile as WorkerProfile | null;
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2 | 3 | 4>(1);
  const autoCheckedRef = useRef(false);

  useEffect(() => {
    if (isLoading || autoCheckedRef.current) return;
    if (shouldAutoShowOnboarding(workerProfile)) {
      setShowOnboarding(true);
    }
    autoCheckedRef.current = true;
  }, [isLoading, workerProfile]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const fetchUnread = () => {
      fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (active) setUnreadCount(data.unread_count || 0);
        })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <OnboardingContext.Provider
      value={{
        openOnboarding: (step) => {
          setOnboardingInitialStep((step as 1 | 2 | 3 | 4) || 1);
          setShowOnboarding(true);
        },
      }}
    >
    <div className="flex flex-col min-h-screen bg-background">
      {showOnboarding && (
        <WorkerOnboarding initialStep={onboardingInitialStep} onClose={() => setShowOnboarding(false)} />
      )}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border-light px-4 py-3">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <JobyMark className="h-6 w-6" />
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {t("app.name")}
          </span>
        </div>
      </header>

      <RoleMismatchBanner />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface shadow-[0_-2px_12px_-1px_rgb(0_0_0_/_0.06)] safe-area-bottom">
        <div className="mx-auto max-w-lg flex items-stretch">
          <BottomNavLink
            href="/shifts"
            icon={<Briefcase className="h-5 w-5" />}
            label={t("nav.shifts")}
          />
          <BottomNavLink
            href="/my-shifts"
            icon={<ClipboardList className="h-5 w-5" />}
            label={t("nav.my_shifts")}
          />
          <BottomNavLink
            href="/scan"
            icon={<QrCode className="h-5 w-5" />}
            label={t("qr.scan")}
          />
          <BottomNavLink
            href="/earnings"
            icon={<Wallet className="h-5 w-5" />}
            label={t("nav.earnings")}
          />
          <BottomNavLink
            href="/notifications"
            icon={<Bell className="h-5 w-5" />}
            label={t("nav.notifications")}
            badge={unreadCount}
          />
          <BottomNavLink
            href="/profile"
            icon={<User className="h-5 w-5" />}
            label={t("nav.profile")}
          />
        </div>
      </nav>
    </div>
    </OnboardingContext.Provider>
  );
}
