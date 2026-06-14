"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface OccupationOption {
  key: string;
  label_he: string;
}

interface OccupationPickerProps {
  options: OccupationOption[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  disabled?: boolean;
}

export function OccupationPicker({
  options,
  value,
  onChange,
  label,
  disabled,
}: OccupationPickerProps) {
  function toggle(key: string) {
    if (disabled) return;
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value.includes(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              disabled={disabled}
              aria-pressed={selected}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.96]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                selected
                  ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                  : "border-border bg-surface text-foreground-secondary hover:border-primary/50 hover:text-foreground",
                disabled && "opacity-50 cursor-not-allowed active:scale-100"
              )}
            >
              {selected && <Check className="h-3.5 w-3.5 shrink-0 animate-pop-in" />}
              {opt.label_he}
            </button>
          );
        })}
      </div>
    </div>
  );
}
