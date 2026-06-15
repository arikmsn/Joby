"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Bell, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/lib/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function iconFor(type: string) {
  if (type === "APPLICATION_APPROVED") return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (type.includes("CANCEL") || type.includes("NO_SHOW")) return <AlertTriangle className="h-5 w-5 text-warning" />;
  return <Info className="h-5 w-5 text-primary" />;
}

export default function NotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setItems(data.notifications || []))
      .finally(() => setLoading(false));
  }, [token]);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border-light">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3.5">
              <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 px-4 animate-fade-in">
          <Bell className="h-8 w-8 text-foreground-tertiary mx-auto mb-3" />
          <p className="text-foreground font-semibold">{t("notification.empty_title")}</p>
          <p className="text-sm text-foreground-secondary mt-1">{t("notification.empty_sub")}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border-light animate-card-pop">
          {items.map((n) => {
            const isPositive = n.type === "APPLICATION_APPROVED";
            return (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-right transition-colors duration-200 hover:bg-background/60 active:bg-border-light ${
                  n.is_read ? "bg-surface" : isPositive ? "bg-success/5" : "bg-primary/5"
                }`}
              >
                <div className="shrink-0 mt-0.5">{iconFor(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{n.title}</p>
                    <AnimatePresence initial={false}>
                      {!n.is_read && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          transition={{ duration: 0.2 }}
                          className={`h-2 w-2 rounded-full shrink-0 ${isPositive ? "bg-success" : "bg-primary"}`}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                  {n.body && <p className="text-sm text-foreground-secondary mt-0.5">{n.body}</p>}
                  {n.created_at && (
                    <p className="text-xs text-foreground-tertiary mt-1">{formatTime(n.created_at)}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
