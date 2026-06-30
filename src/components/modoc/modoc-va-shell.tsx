"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ModocGlobalPanel } from "./modoc-global-panel";
import { useModocOptional } from "./use-modoc";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { canShowCreatorVa } from "@/lib/modoc/creator-va";

type ModocContextPreview = {
  unreadVaCount?: number;
  isNewSessionToday?: boolean;
};

const ATTENTION_PULSES = 3;
const PULSE_GAP_MS = 700;

/** Creator Virtual Assistant (MODOC backend) — FAB + slide-over panel in /creator only. */
export function ModocVaShell() {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const modoc = useModocOptional();
  const { deviceClass } = useAdaptiveUi();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [preview, setPreview] = useState<ModocContextPreview>({});
  const [throbActive, setThrobActive] = useState(false);
  const pulseRunRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshPreview = useCallback(() => {
    if (sessionStatus !== "authenticated") return;
    const projectMatch = pathname.match(/\/creator\/projects\/([^/]+)/);
    const qs = projectMatch ? `?projectId=${projectMatch[1]}` : "";
    fetch(`/api/modoc/context${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setPreview(d);
      })
      .catch(() => {});
  }, [pathname, sessionStatus]);

  useEffect(() => {
    fetch("/api/modoc/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAvailable(Boolean(d?.available)))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  // Triple throb when creator saves in a tool; dismiss nudge if ignored.
  useEffect(() => {
    if (!modoc?.attentionPulseKey) return;
    const runId = ++pulseRunRef.current;
    let pulseIndex = 0;

    const runPulse = () => {
      if (pulseRunRef.current !== runId) return;
      if (openRef.current) return;
      if (pulseIndex >= ATTENTION_PULSES) {
        setThrobActive(false);
        modoc.dismissActivityNudge();
        return;
      }
      setThrobActive(true);
      pulseIndex += 1;
      window.setTimeout(() => {
        setThrobActive(false);
        window.setTimeout(runPulse, PULSE_GAP_MS);
      }, 550);
    };

    runPulse();
  }, [modoc?.attentionPulseKey, modoc]);

  useEffect(() => {
    if (!modoc) return;
    const openFromEvent = () => {
      modoc.consumeActivityNudge();
      setThrobActive(false);
      pulseRunRef.current += 1;
      setOpen(true);
    };
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ prompt?: string }>;
      openFromEvent();
      const prompt = ev.detail?.prompt?.trim();
      if (prompt) {
        window.setTimeout(() => {
          void modoc.append({ role: "user", content: prompt });
        }, 150);
      }
    };
    window.addEventListener("modoc:open-creator", handler);
    return () => window.removeEventListener("modoc:open-creator", handler);
  }, [modoc]);

  if (!modoc || !available) return null;

  if (!canShowCreatorVa({ sessionStatus, role, pathname })) {
    return null;
  }

  const isMobile = deviceClass === "mobile";
  const fabSize = isMobile ? 52 : 58;
  const unread = preview.unreadVaCount ?? 0;
  const pulse = preview.isNewSessionToday && !open && !throbActive;

  const handleOpen = () => {
    modoc.consumeActivityNudge();
    setThrobActive(false);
    pulseRunRef.current += 1;
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`fixed z-[1980] flex items-center justify-center overflow-hidden rounded-full border-2 border-orange-400/40 bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 shadow-lg shadow-orange-500/40 transition hover:scale-105 hover:shadow-orange-500/50 active:scale-95 ${pulse ? "animate-pulse" : ""} ${throbActive ? "modoc-va-throb" : ""}`}
        style={{
          width: fabSize,
          height: fabSize,
          bottom: isMobile ? "max(1rem, env(safe-area-inset-bottom))" : "1.25rem",
          right: isMobile ? "max(1rem, env(safe-area-inset-right))" : "1.25rem",
        }}
        aria-label="Open Virtual Assistant"
        title="Virtual Assistant (VA) — your creator workspace assistant"
      >
        <Image
          src="/modoc-va-logo.png"
          alt="Virtual Assistant"
          width={fabSize - 8}
          height={fabSize - 8}
          className="rounded-full object-cover"
          priority
        />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-orange-600 ring-2 ring-orange-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <ModocGlobalPanel
        open={open}
        onClose={() => {
          setOpen(false);
          modoc.clearOpeningActivityNudge();
          refreshPreview();
        }}
      />
    </>
  );
}
