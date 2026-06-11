"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bot } from "lucide-react";
import { ModocViewerPanel } from "./modoc-viewer-panel";
import { useModocOptional } from "./use-modoc";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { canShowViewerModoc } from "@/lib/modoc/viewer-va";

type ViewerContextPreview = {
  unreadVaCount?: number;
  isNewSessionToday?: boolean;
};

/** Viewer MODOC — FAB + full-screen panel on /browse for subscribers. */
export function ModocViewerShell() {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const modoc = useModocOptional();
  const { deviceClass } = useAdaptiveUi();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [preview, setPreview] = useState<ViewerContextPreview>({});

  const contentMatch = pathname.match(/\/browse\/content\/([^/]+)/);
  const contentId = contentMatch?.[1];

  const refreshPreview = useCallback(() => {
    if (sessionStatus !== "authenticated") return;
    const qs = new URLSearchParams({ scope: "browse" });
    if (contentId) qs.set("contentId", contentId);
    fetch(`/api/modoc/context?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setPreview(d);
      })
      .catch(() => {});
  }, [sessionStatus, contentId]);

  useEffect(() => {
    fetch("/api/modoc/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAvailable(Boolean(d?.available)))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("modoc:open-viewer", openHandler);
    return () => window.removeEventListener("modoc:open-viewer", openHandler);
  }, []);

  if (!modoc || !available) return null;

  if (!canShowViewerModoc({ sessionStatus, role, pathname })) {
    return null;
  }

  const isMobile = deviceClass === "mobile";
  const fabSize = isMobile ? 52 : 58;
  const unread = preview.unreadVaCount ?? 0;
  const pulse = preview.isNewSessionToday && !open;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed z-[1980] flex items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400/35 bg-gradient-to-br from-cyan-500 via-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/35 transition hover:scale-105 hover:shadow-cyan-500/45 active:scale-95 ${pulse ? "animate-pulse" : ""}`}
        style={{
          width: fabSize,
          height: fabSize,
          bottom: isMobile ? "max(5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" : "1.25rem",
          right: isMobile ? "max(1rem, env(safe-area-inset-right))" : "1.25rem",
        }}
        aria-label="Open MODOC"
        title="MODOC — find titles, search scenes, get recommendations"
      >
        <Bot className="h-6 w-6 text-white md:h-7 md:w-7" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-cyan-700 ring-2 ring-cyan-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <ModocViewerPanel
        open={open}
        onClose={() => {
          setOpen(false);
          refreshPreview();
        }}
      />
    </>
  );
}
