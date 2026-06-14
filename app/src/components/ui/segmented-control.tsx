"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  className?: string;
}

/** Pill-style segmented control with an animated sliding active indicator. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId = "segmented-control-pill",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-1 rounded-full bg-background border border-border p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 active:scale-[0.97]",
              active ? "text-white" : "text-foreground-secondary hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={{ type: "spring", duration: 0.4, bounce: 0.18 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
              {opt.label}
              {typeof opt.badge === "number" && opt.badge > 0 && (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    active ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
                  )}
                >
                  {opt.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
