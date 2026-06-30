"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Info, X } from "lucide-react";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { PersonCardPreview } from "./person-card-preview";
import { prefetchPersonPreview, usePersonPreview } from "./use-person-preview";

export type PersonCardTriggerProps = {
  personId?: string | null;
  crewMemberId?: string | null;
  name: string;
  roles: string[];
  imageUrl?: string | null;
  profileHref?: string | null;
  verified?: boolean;
};

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PersonCardTrigger({
  personId,
  crewMemberId,
  name,
  roles,
  imageUrl,
  profileHref,
  verified,
}: PersonCardTriggerProps) {
  const { inputMode } = useAdaptiveUi();
  const isTouch = inputMode === "touch";
  const tooltipId = useId();

  const [hoverOpen, setHoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewEnabled = hoverOpen || sheetOpen;
  const { preview, loading, load } = usePersonPreview({
    personId,
    crewMemberId,
    enabled: previewEnabled,
  });

  const href = profileHref ?? preview?.profileHref ?? (personId ? `/browse/people/${personId}` : undefined);
  const rolesLabel = roles.join(" • ");

  const openHover = useCallback(() => {
    if (isTouch) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHoverOpen(true);
    prefetchPersonPreview(personId, crewMemberId);
  }, [isTouch, personId, crewMemberId]);

  const closeHover = useCallback(() => {
    if (isTouch) return;
    closeTimer.current = setTimeout(() => setHoverOpen(false), 120);
  }, [isTouch]);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    void load();
  }, [load]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const openPreview = useCallback(() => {
    if (isTouch) {
      openSheet();
    } else {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setHoverOpen(true);
      prefetchPersonPreview(personId, crewMemberId);
      void load();
    }
  }, [isTouch, openSheet, personId, crewMemberId, load]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPreview();
      }
    },
    [openPreview],
  );

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  const avatar = (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-slate-700/80 to-slate-900 shadow-lg sm:h-20 sm:w-20">
      {imageUrl ? (
        <Image src={imageUrl} alt="" fill className="object-cover" sizes="80px" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-base font-semibold text-white sm:text-lg">
          {initialsFor(name)}
        </span>
      )}
    </div>
  );

  const nameBlock = (
    <div className="min-w-0 text-center">
      <p className="flex items-center justify-center gap-1 line-clamp-1 text-sm font-medium text-white">
        {name}
        {verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden /> : null}
      </p>
      <p className="line-clamp-2 text-[11px] leading-snug text-slate-400">{rolesLabel}</p>
    </div>
  );

  return (
    <>
      <div
        className="group relative w-[8.5rem] shrink-0 snap-start sm:w-[9rem]"
        onMouseEnter={openHover}
        onMouseLeave={closeHover}
      >
        <div className="flex flex-col items-center gap-2 rounded-xl p-2 transition hover:bg-white/[0.04]">
          {href ? (
            <Link
              href={href}
              className="flex flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
              aria-describedby={!isTouch && hoverOpen ? tooltipId : undefined}
              aria-label={`${name}, ${rolesLabel}`}
              onFocus={openHover}
              onBlur={closeHover}
              onKeyDown={handleKeyDown}
            >
              {avatar}
              {nameBlock}
            </Link>
          ) : (
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
              onClick={isTouch ? openSheet : undefined}
              onFocus={openHover}
              onBlur={closeHover}
              onKeyDown={handleKeyDown}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen || hoverOpen}
              aria-label={`${name}, ${rolesLabel}`}
            >
              {avatar}
              {nameBlock}
            </button>
          )}

          {isTouch ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openSheet();
              }}
              className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-slate-900/90 text-slate-300 shadow"
              aria-label={`More about ${name}`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {!isTouch && hoverOpen ? (
          <div
            id={tooltipId}
            role="tooltip"
            className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2"
            onMouseEnter={openHover}
            onMouseLeave={closeHover}
          >
            <PersonCardPreview preview={preview} loading={loading} />
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {sheetOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close profile preview"
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${name} profile`}
              className="fixed inset-x-0 bottom-0 z-[201] max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-950 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-400">Credits profile</p>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <PersonCardPreview preview={preview} loading={loading} className="w-full" />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
