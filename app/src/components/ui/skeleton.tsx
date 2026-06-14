import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md bg-border-light", className)} />;
}

/** Skeleton placeholder for a feed/list row card. */
export function ShiftRowSkeleton() {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="shrink-0 space-y-2 text-left">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

export function ShiftListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border-light">
      {Array.from({ length: rows }).map((_, i) => (
        <ShiftRowSkeleton key={i} />
      ))}
    </div>
  );
}
