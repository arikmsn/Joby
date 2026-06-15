"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CalendarShift {
  id: string;
  date: Date;
  business_name: string;
  status: string;
}

interface ShiftCalendarProps {
  shifts: CalendarShift[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function statusDotClass(status: string) {
  if (["APPROVED", "CONFIRMED", "CHECKED_IN"].includes(status)) return "bg-primary";
  if (status === "PENDING") return "bg-warning";
  if (["RATED", "CHECKED_OUT"].includes(status)) return "bg-success";
  return "bg-foreground-tertiary";
}

export function ShiftCalendar({ shifts, selectedDate, onSelectDate }: ShiftCalendarProps) {
  const [monthDate, setMonthDate] = useState(() => {
    const d = selectedDate || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, CalendarShift[]>();
    for (const s of shifts) {
      const key = dayKey(s.date);
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [shifts]);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const today = new Date();

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={() => setMonthDate(new Date(year, month - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-secondary hover:bg-background hover:text-foreground transition-colors"
          aria-label="חודש קודם"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-foreground">
          {monthDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setMonthDate(new Date(year, month + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-secondary hover:bg-background hover:text-foreground transition-colors"
          aria-label="חודש הבא"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] font-medium text-foreground-tertiary py-1">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dayShifts = shiftsByDay.get(dayKey(d)) || [];
          const hasShifts = dayShifts.length > 0;
          const isToday = dayKey(d) === dayKey(today);
          const isSelected = selectedDate && dayKey(d) === dayKey(selectedDate);
          return (
            <button
              key={i}
              type="button"
              disabled={!hasShifts}
              onClick={() => onSelectDate(isSelected ? null : d)}
              className={cn(
                "aspect-square flex flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition-colors",
                isSelected
                  ? "bg-primary text-white font-bold"
                  : hasShifts
                    ? "hover:bg-background active:scale-[0.96]"
                    : "text-foreground-tertiary",
                !isSelected && isToday && "ring-1 ring-primary/40 font-bold text-primary"
              )}
            >
              <span>{d.getDate()}</span>
              {hasShifts && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-white" : statusDotClass(dayShifts[0].status)
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
