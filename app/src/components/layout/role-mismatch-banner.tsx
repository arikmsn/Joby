"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { t } from "@/lib/i18n/he";

export function RoleMismatchBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  if (searchParams.get("notice") !== "role_mismatch") return null;

  return (
    <div className="bg-primary/5 border-b border-primary/10 px-4 py-2">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
        <p className="text-xs text-foreground-secondary">{t("auth.role_mismatch_notice")}</p>
        <button
          onClick={() => router.replace(pathname)}
          className="shrink-0 text-foreground-tertiary hover:text-foreground-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
