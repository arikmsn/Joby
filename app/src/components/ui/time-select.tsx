import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { TIME_OPTIONS } from "@/lib/time-options";
import { Clock, ChevronDown } from "lucide-react";

export interface TimeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

const TimeSelect = forwardRef<HTMLSelectElement, TimeSelectProps>(
  ({ className, label, id, value, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
          <select
            ref={ref}
            id={id}
            dir="ltr"
            value={value}
            className={cn(
              "w-full appearance-none cursor-pointer rounded-[var(--radius)] border border-border bg-surface pl-9 pr-8 py-2.5 text-sm font-medium text-center",
              "hover:border-foreground-tertiary/40",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "transition-colors duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:hover:border-border",
              !value && "text-foreground-tertiary",
              className
            )}
            {...props}
          >
            <option value="" disabled>
              --:--
            </option>
            {TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-tertiary" />
        </div>
      </div>
    );
  }
);

TimeSelect.displayName = "TimeSelect";
export { TimeSelect };
