"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Briefcase, ClipboardList, User, Bell, Wallet } from "lucide-react";
import { BottomNavLink } from "./nav-link";
import { RoleMismatchBanner } from "./role-mismatch-banner";
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
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border-light px-4 py-2.5">
        <div className="flex items-center justify-center max-w-lg mx-auto">
          <Image
            src="/joby-wordmark.png"
            alt={t("app.name")}
            width={104}
            height={67}
            priority
            className="h-9 w-auto object-contain"
          />
        </div>
      </header>

      <RoleMismatchBanner />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface shadow-[0_-6px_20px_-6px_rgb(15_23_42_/_0.12)] safe-area-bottom">
        <div className="mx-auto max-w-lg flex items-stretch px-2 py-1">
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
