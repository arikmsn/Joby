"use client";

import { Bell } from "lucide-react";
import { t } from "@/lib/i18n/he";

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{t("nav.notifications")}</h1>
      <div className="text-center py-20 px-4">
        <Bell className="h-8 w-8 text-foreground-tertiary mx-auto mb-3" />
        <p className="text-foreground font-semibold">אין התראות חדשות</p>
        <p className="text-sm text-foreground-secondary mt-1">התראות יופיעו כאן כשיהיו עדכונים</p>
      </div>
    </div>
  );
}
