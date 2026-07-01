"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { PersonCardPreview } from "./person-card-preview";
import { prefetchPersonPreview, usePersonPreview } from "./use-person-preview";

export type PersonCardTriggerProps = {
  personId?: string | null;
  crewMemberId?: string | null;
  name: string;
  roles: string[];
  imageUrl?: string | null;
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
  verified,
}: PersonCardTriggerProps) {
  const { inputMode } = useAdaptiveUi();
  const isTouch = inputMode === "touch";
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const { preview, loading, load } = usePersonPreview({
    personId,
    crewMemberId,
    enabled: open,
  });

  const rolesLabel = roles.join(" • ");

  useEffect(() => setMounted(true), []);

  const updateAnchor = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const openPreview = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    updateAnchor();
    setOpen(true);
    prefetchPersonPreview(personId, crewMemberId);
    void load();
  }, [updateAnchor, personId, crewMemberId, load]);

  const closePreview = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const togglePreview = useCallback(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setOpen(false);
      return;
    }
    openPreview();
  }, [open, openPreview]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => {
      updateAnchor();
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updateAnchor]);

  useEffect(() => {
    if (!open || !isTouch) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (cardRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, isTouch]);

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

  const popover =
    mounted && open && anchor
      ? createPortal(
          <div
            className="fixed z-[180] w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2"
            style={{ top: anchor.top, left: anchor.left }}
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
            }}
            onMouseLeave={closePreview}
          >
            <PersonCardPreview preview={preview} loading={loading} />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={cardRef}
        className="relative w-[8.5rem] shrink-0 sm:w-[9rem]"
        onMouseEnter={isTouch ? undefined : openPreview}
        onMouseLeave={isTouch ? undefined : closePreview}
      >
        <button
          type="button"
          className={`flex w-full flex-col items-center gap-2 rounded-xl p-2 outline-none transition focus-visible:ring-2 focus-visible:ring-orange-500/60 ${
            open ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
          }`}
          aria-expanded={open}
          aria-label={`${name}, ${rolesLabel}`}
          onClick={isTouch ? togglePreview : undefined}
        >
          {avatar}
          {nameBlock}
        </button>
      </div>
      {popover}
    </>
  );
}
