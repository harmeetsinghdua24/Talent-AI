"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Briefcase, Star, X, CalendarClock, FileCheck, Sparkles } from "lucide-react";
import { api, NotificationData } from "@/lib/api";

const iconFor: Record<string, React.ElementType> = {
  new_application: Briefcase,
  shortlisted: Star,
  rejected: X,
  interview_scheduled: CalendarClock,
  offer_generated: FileCheck,
  new_job_match: Sparkles,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    api.myNotifications().then((r) => {
      setUnreadCount(r.unread_count);
      setNotifications(r.notifications);
    });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000); // poll every 20s for near-real-time updates
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleClickNotification(n: NotificationData) {
    if (!n.is_read) {
      await api.markNotificationRead(n.id);
      load();
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    await api.markAllNotificationsRead();
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-canvas transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="font-display font-semibold text-sm text-ink">Notifications</h4>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-brand hover:text-brand-hover flex items-center gap-1">
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted">No notifications yet.</p>
              ) : (
                notifications.map((n) => {
                  const Icon = iconFor[n.type] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClickNotification(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border last:border-0 hover:bg-canvas/60 transition-colors ${
                        !n.is_read ? "bg-brand-tint/40" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-brand-tint flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={13} className="text-brand" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${!n.is_read ? "font-medium text-ink" : "text-ink-muted"}`}>{n.message}</p>
                        <p className="text-xs text-ink-faint mt-0.5">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
