"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronLeft } from "lucide-react";
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

type NotificationResponse = {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
  offset: number;
  limit: number;
};

export function NotificationCenterClient({
  role,
  backHref,
}: {
  role: string | null;
  backHref: string;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const load = async (nextOffset: number, append: boolean) => {
    const url = `/api/notifications?limit=${limit}&offset=${nextOffset}`;
    const res = await fetch(url);
    const data = (res.ok ? await res.json().catch(() => ({})) : {}) as Partial<NotificationResponse>;
    const nextItems = data.notifications ?? [];
    setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
    setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    setHasMore(Boolean(data.hasMore));
    setOffset(nextOffset + nextItems.length);
  };

  useEffect(() => {
    setLoading(true);
    void load(0, false).finally(() => setLoading(false));
  }, []);

  const unreadIds = useMemo(() => items.filter((n) => !n.read).map((n) => n.id), [items]);

  const markRead = async (ids: string[], markAllRead = false) => {
    if (!markAllRead && ids.length === 0) return;
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(markAllRead ? { markAllRead: true, read: true } : { ids, read: true }),
    });
    const data = (res.ok ? await res.json().catch(() => ({})) : {}) as { unreadCount?: number };
    if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount);
    setItems((prev) =>
      prev.map((n) => (markAllRead || ids.includes(n.id) ? { ...n, read: true } : n)),
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Bell className="h-6 w-6 text-orange-400" />
            Notification center
          </h1>
          <p className="text-sm text-slate-400">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <button
          type="button"
          disabled={unreadCount === 0}
          onClick={() => void markRead([], true)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06] disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all as read
        </button>
      </div>

      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/96 shadow-2xl">
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-200">Loading notifications…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-200">No notifications yet.</p>
        ) : (
          items.map((n) => {
            const url = resolveNotificationUrl(n, role);
            return (
              <div
                key={n.id}
                className={[
                  "border-b border-slate-700/70 px-4 py-3 last:border-b-0",
                  n.read ? "bg-transparent" : "bg-slate-800/70",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-white">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-200">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</p>
                  <div className="flex items-center gap-3">
                    {!n.read ? (
                      <button
                        type="button"
                        onClick={() => void markRead([n.id])}
                        className="text-xs text-slate-300 hover:text-white"
                      >
                        Mark read
                      </button>
                    ) : null}
                    {url ? (
                      <Link
                        href={url}
                        className="text-xs font-medium text-orange-300 hover:text-orange-200"
                        onClick={() => {
                          if (!n.read) {
                            void markRead([n.id]);
                          }
                        }}
                      >
                        {notificationActionLabel(n)}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              void load(offset, true).finally(() => setLoadingMore(false));
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      {unreadIds.length > 0 ? (
        <p className="text-center text-[11px] text-slate-500">
          Tip: open a notification action to jump to the exact place it came from.
        </p>
      ) : null}
    </div>
  );
}

