"use client";

import { useEffect } from "react";
import { PartyPopper, Sparkles, X } from "lucide-react";
import { t } from "@/lib/i18n/he";

interface CelebrationToastProps {
  title: string;
  subtitle?: string;
  onDismiss: () => void;
}

export function CelebrationToast({ title, subtitle, onDismiss }: CelebrationToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4 pointer-events-none">
      <div className="animate-celebration-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-float">
        <div className="approved-glow flex items-start gap-3 p-4">
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
              <PartyPopper className="h-5 w-5" />
            </div>
            <Sparkles className="animate-sparkle absolute -top-1.5 -right-1.5 h-4 w-4 text-warning" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="font-bold text-foreground leading-snug">{title}</p>
            {subtitle && <p className="text-sm text-foreground-secondary mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-full p-1 text-foreground-tertiary hover:bg-black/5 hover:text-foreground transition-colors"
            aria-label={t("general.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
