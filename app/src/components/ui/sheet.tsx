"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Mobile-first bottom sheet. Slides up from the bottom with a fading
 * backdrop; closes on backdrop tap, X button, or Escape.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative z-10 max-h-[85vh] w-full max-w-lg mx-auto overflow-y-auto rounded-t-2xl bg-surface shadow-float",
              className
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-4 pb-2">
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="close"
                  className="rounded-full p-1.5 text-foreground-tertiary transition-colors hover:bg-background hover:text-foreground active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
