"use client";

import { t } from "@/lib/i18n/he";
import { Users } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{t("admin.users")}</h1>
      <div className="text-center py-16 bg-surface rounded-xl border border-border">
        <Users className="h-12 w-12 text-foreground-tertiary mx-auto mb-3" />
        <p className="text-foreground-secondary font-medium">ניהול משתמשים</p>
        <p className="text-sm text-foreground-tertiary mt-1">יתווסף בספרינט הבא</p>
      </div>
    </div>
  );
}
