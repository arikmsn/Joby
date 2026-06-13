"use client";

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
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-foreground-secondary hover:border-primary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {opt.label_he}
            </button>
          );
        })}
      </div>
    </div>
  );
}
