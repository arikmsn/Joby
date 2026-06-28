"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Users,
  ScrollText,
  LogOut,
  LayoutGrid,
  Building2,
  CalendarDays,
  Tags,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { NavLink } from "./nav-link";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";

const NAV_ITEMS = [
  { href: "/overview", icon: LayoutGrid, labelKey: "nav.overview" as const },
  { href: "/employers", icon: Building2, labelKey: "nav.employers" as const },
  { href: "/workers", icon: Users, labelKey: "nav.workers" as const },
  { href: "/admin-shifts", icon: CalendarDays, labelKey: "nav.shifts" as const },
  { href: "/admin-reports", icon: BarChart3, labelKey: "nav.reports" as const },
  { href: "/catalog", icon: Tags, labelKey: "nav.catalog" as const },
  { href: "/incidents", icon: AlertTriangle, labelKey: "nav.incidents" as const },
  { href: "/action-log", icon: ScrollText, labelKey: "nav.log" as const },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-l border-border bg-white">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-primary-600">
            {t("app.name")}
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Admin Panel
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={<item.icon className="h-5 w-5" />}
              label={t(item.labelKey)}
            />
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
            {t("auth.logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 -mr-1 rounded-lg text-foreground-secondary hover:bg-gray-50 active:scale-90 transition-all duration-150"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div>
                <h1 className="text-lg font-bold text-primary-600">{t("app.name")}</h1>
                <p className="text-xs text-foreground-secondary">Admin</p>
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <nav className="mt-3 pt-3 border-t border-border space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      icon={<item.icon className="h-5 w-5" />}
                      label={t(item.labelKey)}
                      onClick={() => setMobileMenuOpen(false)}
                    />
                  ))}
                  <button
                    onClick={() => { setMobileMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors duration-150"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("auth.logout")}
                  </button>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
