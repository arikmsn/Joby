"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface CollapsibleProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Expand/collapse section with a smooth height animation and rotating chevron. */
export function Collapsible({ trigger, children, defaultOpen = false, className }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <span className="flex-1 text-right">{trigger}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="shrink-0 text-foreground-tertiary"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn("overflow-hidden")}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
