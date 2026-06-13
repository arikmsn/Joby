"use client";

import { Bell } from "lucide-react";
import { t } from "@/lib/i18n/he";

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{t("nav.notifications")}</h1>
      <div className="text-center py-16 px-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-7 w-7 text-primary" />
        </div>
        <p className="text-foreground font-semibold">אין התראות חדשות</p>
        <p className="text-sm text-foreground-secondary mt-1">התראות יופיעו כאן כשיהיו עדכונים</p>
      </div>
    </div>
  );
}
