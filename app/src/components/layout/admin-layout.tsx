"use client";

import type { ReactNode } from "react";
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
} from "lucide-react";
import { NavLink } from "./nav-link";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-l border-[var(--border)] bg-white">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-xl font-bold text-primary-600">
            {t("app.name")}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Admin Panel
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink
            href="/overview"
            icon={<LayoutGrid className="h-5 w-5" />}
            label={t("nav.overview")}
          />
          <NavLink
            href="/employers"
            icon={<Building2 className="h-5 w-5" />}
            label={t("nav.employers")}
          />
          <NavLink
            href="/workers"
            icon={<Users className="h-5 w-5" />}
            label={t("nav.workers")}
          />
          <NavLink
            href="/admin-shifts"
            icon={<CalendarDays className="h-5 w-5" />}
            label={t("nav.shifts")}
          />
          <NavLink
            href="/admin-reports"
            icon={<BarChart3 className="h-5 w-5" />}
            label={t("nav.reports")}
          />
          <NavLink
            href="/catalog"
            icon={<Tags className="h-5 w-5" />}
            label={t("nav.catalog")}
          />
          <NavLink
            href="/incidents"
            icon={<AlertTriangle className="h-5 w-5" />}
            label={t("nav.incidents")}
          />
          <NavLink
            href="/action-log"
            icon={<ScrollText className="h-5 w-5" />}
            label={t("nav.log")}
          />
        </nav>

        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
            {t("auth.logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
