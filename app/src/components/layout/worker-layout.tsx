"use client";

import type { ReactNode } from "react";
import { Briefcase, ClipboardList, User, Bell, QrCode } from "lucide-react";
import { BottomNavLink } from "./nav-link";
import { t } from "@/lib/i18n/he";

export function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border-light px-4 py-2.5">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              J
            </div>
            <span className="text-base font-bold text-foreground">
              {t("app.name")}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 safe-area-bottom">
        <div className="mx-auto max-w-lg px-3 pb-3">
          <div className="flex items-center justify-around rounded-2xl border border-border bg-surface/95 backdrop-blur-md shadow-float px-1 py-1.5">
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
              href="/notifications"
              icon={<Bell className="h-5 w-5" />}
              label={t("nav.notifications")}
            />
            <BottomNavLink
              href="/profile"
              icon={<User className="h-5 w-5" />}
              label={t("nav.profile")}
            />
          </div>
        </div>
      </nav>
    </div>
  );
}
