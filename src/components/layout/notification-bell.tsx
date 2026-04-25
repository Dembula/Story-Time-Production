"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { createPortal } from "react-dom";
import { notificationActionLabel, resolveNotificationUrl } from "@/lib/notification-links";

type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  type: string;
  metadata?: string | null;
};

export function NotificationBell() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({ top: 72, right: 16 });
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);

  const refreshPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=8");
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshPreview();
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshPreview();
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !buttonEl) return;
    const syncPos = () => {
      const rect = buttonEl.getBoundingClientRect();
      setPanelPos({
        top: Math.round(rect.bottom + 10),
        right: Math.max(8, Math.round(window.innerWidth - rect.right)),
      });
    };
    syncPos();
    window.addEventListener("resize", syncPos);
    window.addEventListener("scroll", syncPos, true);
    return () => {
      window.removeEventListener("resize", syncPos);
      window.removeEventListener("scroll", syncPos, true);
    };
  }, [open, buttonEl]);

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], read: true }),
    }).catch(() => null);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div className="relative">
      <button
        ref={setButtonEl}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-white/8 bg-white/[0.03] p-2.5 text-slate-400 shadow-panel hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] text-white shadow-glow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && mounted
        ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[1200]"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[1210] w-80 rounded-2xl border border-slate-700/80 bg-slate-950/96 shadow-2xl backdrop-blur-sm"
            style={{ top: `${panelPos.top}px`, right: `${panelPos.right}px` }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
              <p className="text-xs font-semibold text-white">Notifications</p>
              <p className="text-[11px] text-slate-300">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-4 text-xs text-slate-200">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-200">
                  You have no notifications yet. Collaboration updates and Story Time announcements will appear here.
                </p>
              ) : (
                items.map((n) => {
                  const linkUrl = resolveNotificationUrl(n, role);
                  const className = [
                    "block border-b border-slate-700/70 px-4 py-3 last:border-b-0",
                    n.read ? "bg-transparent" : "bg-slate-800/70",
                    "transition hover:bg-slate-800/80",
                  ].join(" ");

                  return (
                    <div key={n.id} className={className}>
                      <p className="text-xs font-semibold text-white">{n.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-200">{n.body}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-[10px] text-slate-300">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                        {linkUrl ? (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-orange-300 hover:text-orange-200"
                            onClick={() => {
                              void markOneRead(n.id);
                              setOpen(false);
                              router.push(linkUrl);
                            }}
                          >
                            {notificationActionLabel(n)}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-slate-700/80 px-4 py-2.5">
              <Link
                href="/notifications"
                className="text-xs font-medium text-orange-300 hover:text-orange-200"
                onClick={() => setOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>,
        document.body,
      )
        : null}
    </div>
  );
}

