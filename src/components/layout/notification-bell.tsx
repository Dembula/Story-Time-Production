"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!open || items.length > 0) return;
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.ok ? r.json() : { notifications: [], unreadCount: 0 })
      .then((data) => {
        setItems(data.notifications ?? []);
        setUnread(data.unreadCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, [open, items.length]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 hover:bg-slate-800/60 rounded-lg transition text-slate-400 hover:text-white"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-[10px] text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-700 bg-[#050814] shadow-xl z-50">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-white">Notifications</p>
              <p className="text-[11px] text-slate-500">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-4 text-xs text-slate-400">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-400">
                  You have no notifications yet. Collaboration updates and Story Time announcements will appear here.
                </p>
              ) : (
                items.map((n) => {
                  let linkUrl: string | null = null;
                  try {
                    if (n.metadata) {
                      const meta = JSON.parse(n.metadata) as { url?: string };
                      if (meta?.url) linkUrl = meta.url;
                    }
                  } catch {}
                  const className = [
                    "block px-4 py-3 border-b border-slate-800 last:border-b-0",
                    n.read ? "bg-transparent" : "bg-slate-900/60",
                    linkUrl ? "hover:bg-slate-800/60 transition" : "",
                  ].join(" ");
                  const content = (
                    <>
                      <p className="text-xs font-semibold text-white">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </>
                  );
                  return linkUrl ? (
                    <Link key={n.id} href={linkUrl} className={className}>
                      {content}
                    </Link>
                  ) : (
                    <div key={n.id} className={className}>
                      {content}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

