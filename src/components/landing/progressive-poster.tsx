"use client";

import { useCallback, useEffect, useState } from "react";
import { MediaImage } from "@/components/media/media-image";
import { computeIsMobileLikeClient } from "@/lib/player/mobile-detect";

type ProgressivePosterProps = {
  src: string;
  alt?: string;
  /** Slot index in the sequential unlock queue (0-based). */
  index: number;
  /** How many slots are currently allowed to mount an <img>. */
  unlockedThrough: number;
  /** Force this slot to mount even if not yet reached in the queue (e.g. scrolled into view). */
  forceReveal?: boolean;
  sizes: string;
  className?: string;
  imageClassName?: string;
  /** Notify parent when this slot finished loading (or failed) so the next can start. */
  onSettled?: (index: number) => void;
  priority?: boolean;
};

/**
 * Premium poster cell: always shows a film-like placeholder, then mounts the real
 * image only when unlocked — fades in smoothly. Prevents Safari/Chrome decode storms.
 */
export function ProgressivePoster({
  src,
  alt = "",
  index,
  unlockedThrough,
  forceReveal = false,
  sizes,
  className,
  imageClassName,
  onSettled,
  priority,
}: ProgressivePosterProps) {
  const allowed = forceReveal || index <= unlockedThrough;
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(false);

  const settle = useCallback(() => {
    if (settled) return;
    setSettled(true);
    setVisible(true);
    onSettled?.(index);
  }, [index, onSettled, settled]);

  useEffect(() => {
    if (!allowed || settled) return;
    // Safety: never block the queue forever if a decode hangs.
    const t = window.setTimeout(settle, 2800);
    return () => window.clearTimeout(t);
  }, [allowed, settled, settle]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015)_42%,rgba(0,0,0,0.35))]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,162,44,0.12),transparent_55%)]"
        aria-hidden
      />
      {allowed ? (
        <MediaImage
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className={`object-cover transition-opacity duration-500 ease-out ${
            visible ? "opacity-100" : "opacity-0"
          } ${imageClassName ?? ""}`}
          onLoad={settle}
          onError={settle}
        />
      ) : null}
    </div>
  );
}

/**
 * Sequential unlock for poster grids. Mobile: one at a time.
 * Desktop: unlock two at a time so the wall still feels rich quickly.
 */
export function useSequentialPosterUnlock(total: number, resetKey = "") {
  const [unlockedThrough, setUnlockedThrough] = useState(0);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    setIsMobile(computeIsMobileLikeClient());
    setUnlockedThrough(0);
  }, [total, resetKey]);

  const onSettled = useCallback(
    (index: number) => {
      setUnlockedThrough((current) => {
        if (index !== current) return current;
        const step = isMobile ? 1 : 2;
        return Math.min(Math.max(0, total - 1), current + step);
      });
    },
    [isMobile, total],
  );

  return { unlockedThrough, onSettled, isMobile };
}
