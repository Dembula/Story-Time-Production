"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { notificationActionLabel, resolveNotificationUrl } from "@/lib/notification-links";
import { notificationTypeAccent, notificationTypeIcon } from "@/lib/ecosystem/notification-visuals";
import {
  jobOverallProgress,
  useCatalogueUploadOptional,
} from "@/components/creator/catalogue-upload-provider";
import {
  catalogueAssetStatusLabel,
  isJobInFlight,
  isJobVisibleInBell,
  jobActiveAssetLabel,
} from "@/lib/catalogue-upload/types";

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
  const catalogueUploads = useCatalogueUploadOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({ top: 72, right: 16 });
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);

  const activeUploadJobs =
    catalogueUploads?.activeJobs.filter(isJobVisibleInBell) ?? [];
  const inFlightCount = activeUploadJobs.filter(isJobInFlight).length;

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

  // Refresh inbox when an upload job completes so the completion notification appears
  useEffect(() => {
    if (!catalogueUploads) return;
    const justFinished = catalogueUploads.jobs.some(
      (j) => j.status === "complete" || j.status === "failed",
    );
    if (justFinished) void refreshPreview();
  }, [catalogueUploads?.jobs]);

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

  const respondToVaSuggestion = async (notificationId: string, accept: boolean) => {
    setLoading(true);
    try {
      let res = await fetch("/api/modoc/suggestions/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, accept }),
      });
      if (accept && res.status === 409) {
        const data = await res.json().catch(() => ({}));
        if (data.suggest) {
          res = await fetch("/api/modoc/suggestions/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId, accept: true, confirmDestructive: true }),
          });
        }
      }
      await markOneRead(notificationId);
      if (accept && res.ok) {
        await refreshPreview();
      }
    } finally {
      setLoading(false);
    }
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], read: true }),
    }).catch(() => null);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => null);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
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
        {(unread > 0 || inFlightCount > 0) && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] text-white shadow-glow">
            {inFlightCount > 0 && unread === 0
              ? inFlightCount > 9
                ? "9+"
                : inFlightCount
              : unread > 9
                ? "9+"
                : unread || inFlightCount}
          </span>
        )}
        {inFlightCount > 0 ? (
          <span className="absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
        ) : null}
      </button>

      {open && mounted
        ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[1200]"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[1210] w-80 rounded-2xl border border-white/12 bg-black/97 shadow-2xl backdrop-blur-2xl"
            style={{ top: `${panelPos.top}px`, right: `${panelPos.right}px` }}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <p className="text-xs font-semibold text-white">Notification center</p>
              <div className="flex items-center gap-2">
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="text-[10px] font-medium text-orange-300 hover:text-orange-200"
                  >
                    Mark all read
                  </button>
                ) : null}
                <p className="text-[11px] text-slate-400">
                  {unread > 0 ? `${unread} unread` : "All caught up"}
                </p>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {activeUploadJobs.length > 0 ? (
                <div className="border-b border-white/8 bg-orange-500/[0.04] px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5 text-orange-300" />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-200/90">
                      Media uploads
                    </p>
                  </div>
                  <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
                    Only files you pick on Media &amp; Assets appear here — poster, backdrop, film, trailer, and more.
                  </p>
                  <div className="space-y-3">
                    {activeUploadJobs.map((job) => {
                      const pct = jobOverallProgress(job);
                      const label = jobActiveAssetLabel(job);
                      const href = job.contentId
                        ? `/creator/upload?contentId=${job.contentId}`
                        : "/creator/upload";
                      const liveAssets = job.assets.filter(
                        (a) =>
                          a.status === "queued" ||
                          a.status === "uploading" ||
                          a.status === "failed" ||
                          (a.status === "complete" && isJobInFlight(job)),
                      );
                      const assetsToShow =
                        liveAssets.length > 0
                          ? liveAssets
                          : job.assets.filter((a) => a.status === "complete" || a.status === "failed").slice(-4);
                      return (
                        <div key={job.id} className="rounded-xl border border-white/8 bg-black/40 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => {
                                setOpen(false);
                                router.push(href);
                              }}
                            >
                              <p className="truncate text-xs font-medium text-white">
                                {job.title || "Catalogue title"}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {job.status === "failed"
                                  ? job.error || "Upload failed"
                                  : job.status === "complete"
                                    ? "All media uploaded"
                                    : job.status === "finalizing"
                                      ? "Saving catalogue entry…"
                                      : label
                                        ? `Now: ${label}`
                                        : "Preparing…"}
                                {job.status !== "failed" && job.status !== "complete"
                                  ? ` · ${pct}% overall`
                                  : ""}
                              </p>
                            </button>
                            {isJobInFlight(job) ? (
                              <button
                                type="button"
                                title="Cancel upload"
                                className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200"
                                onClick={() => catalogueUploads?.cancelJob(job.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Dismiss"
                                className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200"
                                onClick={() => catalogueUploads?.dismissJob(job.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={[
                                "h-full rounded-full transition-all",
                                job.status === "failed"
                                  ? "bg-red-400"
                                  : job.status === "complete"
                                    ? "bg-emerald-400"
                                    : "bg-orange-400",
                              ].join(" ")}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          {assetsToShow.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {assetsToShow.map((asset) => {
                                const assetPct = Math.round(
                                  asset.status === "complete"
                                    ? 100
                                    : Math.min(100, Math.max(0, asset.progress)),
                                );
                                return (
                                  <li key={asset.id} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="min-w-0 truncate text-[10px] font-medium text-slate-200">
                                        {asset.label}
                                      </p>
                                      <span
                                        className={[
                                          "shrink-0 text-[9px] uppercase tracking-wide",
                                          asset.status === "complete"
                                            ? "text-emerald-400"
                                            : asset.status === "failed"
                                              ? "text-red-300"
                                              : asset.status === "uploading"
                                                ? "text-orange-300"
                                                : "text-slate-500",
                                        ].join(" ")}
                                      >
                                        {catalogueAssetStatusLabel(asset.status)}
                                        {asset.status === "uploading" || asset.status === "queued"
                                          ? ` ${assetPct}%`
                                          : ""}
                                      </span>
                                    </div>
                                    {(asset.status === "uploading" || asset.status === "queued") && (
                                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                                        <div
                                          className="h-full rounded-full bg-sky-400/90 transition-all"
                                          style={{ width: `${assetPct}%` }}
                                        />
                                      </div>
                                    )}
                                    {asset.fileName ? (
                                      <p className="mt-0.5 truncate text-[9px] text-slate-600">
                                        {asset.fileName}
                                      </p>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {loading ? (
                <p className="px-4 py-4 text-xs text-slate-200">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-200">
                  {activeUploadJobs.length > 0
                    ? "No other notifications yet."
                    : "You have no notifications yet. Payout alerts, publishing updates, and collaboration events will appear here."}
                </p>
              ) : (
                items.map((n) => {
                  const linkUrl = resolveNotificationUrl(n, role);
                  const Icon = notificationTypeIcon(n.type);
                  const accent = notificationTypeAccent(n.type);
                  const className = [
                    "block border-b border-white/6 px-4 py-3 last:border-b-0",
                    n.read ? "bg-transparent" : "bg-white/[0.04]",
                    "transition hover:bg-white/[0.06]",
                  ].join(" ");

                  return (
                    <div key={n.id} className={className}>
                      <div className="flex gap-2.5">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white">{n.title}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{n.body}</p>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="text-[10px] text-slate-500">
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                            {n.type === "VA_SUGGESTION" ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
                                  onClick={() => void respondToVaSuggestion(n.id, true)}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
                                  onClick={() => void respondToVaSuggestion(n.id, false)}
                                >
                                  No
                                </button>
                              </div>
                            ) : linkUrl ? (
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
