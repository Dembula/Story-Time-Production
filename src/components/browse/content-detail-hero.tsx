"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Play, Plus, Check, ChevronLeft, Download, Clapperboard } from "lucide-react";
import { contentTypeLabel } from "@/lib/content-types";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { markPlaybackPlayIntent } from "@/lib/player/play-intent";
import { beginBrowseNavigation } from "@/lib/navigation/route-transition";

type Props = {
  contentId: string;
  title: string;
  type: string;
  category: string | null;
  year: number | null;
  duration: number | null;
  description: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  autoPlay?: boolean;
  canPlay: boolean;
  inList: boolean;
  onToggleList: () => void;
  onInfoOpen: () => void;
  onPlay: () => void;
  onLockedPlay: () => void;
  playLabel?: string;
  playHref: string;
  onPreparePlay?: () => void;
  onPrepareTrailer?: () => void;
  hasDownload?: boolean;
  downloadState?: string | null;
  onDownload?: () => void;
  isSubscriber: boolean;
  backHref?: string;
};

function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function ContentDetailHero({
  contentId,
  title,
  type,
  category,
  year,
  duration,
  description,
  backdropUrl,
  trailerUrl,
  autoPlay = false,
  canPlay,
  inList,
  onToggleList,
  onInfoOpen,
  onPlay,
  onLockedPlay,
  playLabel = "Play",
  playHref,
  onPreparePlay,
  onPrepareTrailer,
  hasDownload,
  downloadState,
  onDownload,
  isSubscriber,
  backHref = "/browse",
}: Props) {
  const router = useRouter();
  const { deviceClass, orientation, inputMode } = useAdaptiveUi();
  const [expanded, setExpanded] = useState(false);

  const isMobile = deviceClass === "mobile";
  const isTablet = deviceClass === "tablet";
  const isTv = deviceClass === "tv";
  const isRemote = inputMode === "remote";
  const mobileLandscape = isMobile && orientation === "landscape";

  useEffect(() => {
    router.prefetch(backHref);
  }, [router, backHref]);

  useEffect(() => {
    if (!autoPlay) return;
    if (canPlay) {
      onPreparePlay?.();
      router.push(playHref);
    }
  }, [autoPlay, canPlay, onPreparePlay, playHref, router]);

  const metaParts = [
    contentTypeLabel(type),
    category,
    year ? String(year) : null,
    formatRuntime(duration),
  ].filter(Boolean);

  const heroHeight = mobileLandscape
    ? "min-h-[72vh]"
    : isMobile
      ? "min-h-[44vh] max-h-[52vh] sm:min-h-[48vh] sm:max-h-[56vh]"
      : isTablet
        ? "min-h-[58vh]"
        : isTv
          ? "min-h-[78vh]"
          : "min-h-[68vh] lg:min-h-[72vh]";

  const titleSize = isTv
    ? "text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
    : isMobile
      ? "text-2xl xs:text-3xl sm:text-4xl"
      : "text-3xl md:text-5xl lg:text-6xl";

  const playSize = isTv
    ? "h-[4.5rem] w-[4.5rem] md:h-20 md:w-20"
    : isMobile
      ? "h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14"
      : "h-14 w-14 md:h-16 md:w-16";

  const playIconSize = isTv ? "h-8 w-8 md:h-9 md:w-9" : isMobile ? "h-5 w-5 sm:h-6 sm:w-6" : "h-6 w-6 md:h-7 md:w-7";

  const secondaryBtn = isTv
    ? "h-14 w-14 md:h-[3.25rem] md:w-[3.25rem]"
    : isMobile
      ? "h-11 w-11 sm:h-12 sm:w-12"
      : "h-11 w-11 md:h-12 md:w-12";

  const focusRing = isRemote ? "adaptive-interactive focus-visible:outline-none" : "";

  return (
    <div
      className={`relative w-full ${isMobile ? "-mx-4 w-[calc(100%+2rem)]" : ""} ${isTv ? "mx-auto max-w-[1800px]" : ""}`}
    >
      <div
        className={`relative overflow-hidden ${heroHeight} ${
          isMobile ? "" : "md:rounded-b-3xl lg:rounded-b-[2rem]"
        } ${isTv ? "rounded-b-[2.5rem]" : ""}`}
      >
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className={`object-cover ${isMobile ? "object-[center_30%] scale-105" : "object-top"}`}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20 md:via-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_8%,rgba(251,146,60,0.14),transparent_40%)]" />

        {/* Top bar — safe area aware on mobile */}
        <div
          className={`absolute left-0 right-0 top-0 z-10 flex items-center justify-between ${
            isMobile ? "px-3 pt-[max(0.75rem,env(safe-area-inset-top))]" : "px-4 pt-4 md:px-6 md:pt-5"
          } ${isTv ? "px-8 pt-6" : ""}`}
        >
          <Link
            href={backHref}
            onClick={() => beginBrowseNavigation()}
            className={`flex items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 ${focusRing} ${
              isTv ? "h-14 w-14" : "h-10 w-10 sm:h-11 sm:w-11"
            }`}
            aria-label="Back to browse"
          >
            <ChevronLeft className={isTv ? "h-7 w-7" : "h-5 w-5"} />
          </Link>
          {isSubscriber && hasDownload && onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={downloadState === "downloading" || downloadState === "completed"}
              className={`flex items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 disabled:opacity-50 ${focusRing} ${
                isTv ? "h-14 w-14" : "h-10 w-10 sm:h-11 sm:w-11"
              }`}
              aria-label="Download"
            >
              <Download className={isTv ? "h-6 w-6" : "h-4 w-4"} />
            </button>
          )}
        </div>

        {/* Title + actions */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-10 ${
            isMobile
              ? "px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              : "px-4 pb-8 md:px-8 md:pb-10 lg:px-10 lg:pb-12"
          } ${isTv ? "px-10 pb-14" : ""}`}
        >
          <h1
            className={`font-display font-bold leading-[1.08] text-white drop-shadow-lg ${titleSize} ${
              isMobile ? "max-w-[95%]" : "max-w-4xl"
            } ${isTv ? "max-w-5xl tracking-tight" : ""}`}
          >
            {title}
          </h1>

          {metaParts.length > 0 && (
            <p
              className={`mt-1.5 text-slate-300/90 sm:mt-2 ${
                isTv ? "text-lg md:text-xl" : "text-xs sm:text-sm md:text-base"
              }`}
            >
              {metaParts.join(" · ")}
            </p>
          )}

          {description && (
            <div className={`mt-3 sm:mt-4 ${isTv ? "max-w-3xl" : "max-w-2xl"}`}>
              <p
                className={`leading-relaxed text-slate-300/90 ${
                  isTv ? "text-base md:text-lg" : "text-xs sm:text-sm md:text-base"
                } ${expanded ? "" : "line-clamp-2 sm:line-clamp-3"}`}
              >
                {description}
              </p>
              {description.length > (isMobile ? 80 : 120) && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className={`mt-1.5 rounded-md bg-white/10 px-2.5 py-1 font-semibold uppercase tracking-wider text-slate-300 transition hover:bg-white/15 ${focusRing} ${
                    isTv ? "text-xs" : "text-[10px] sm:text-[11px]"
                  }`}
                >
                  {expanded ? "Less" : "More"}
                </button>
              )}
            </div>
          )}

          {/* Actions — wrap on narrow mobile; pill play label on tablet+ */}
          <div
            className={`mt-5 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3 ${
              isTv ? "mt-8 gap-4" : ""
            }`}
          >
            {canPlay ? (
              <button
                type="button"
                onPointerDown={() => {
                  markPlaybackPlayIntent();
                  onPreparePlay?.();
                }}
                onFocus={() => onPreparePlay?.()}
                onClick={onPlay}
                className={`flex shrink-0 items-center justify-center rounded-full bg-white shadow-[0_8px_32px_rgba(255,255,255,0.22)] transition hover:scale-105 active:scale-95 ${playSize} ${focusRing}`}
                aria-label={playLabel}
              >
                <Play className={`fill-slate-900 text-slate-900 ${playIconSize}`} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onLockedPlay}
                className={`flex shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md transition hover:bg-white/15 ${playSize} ${focusRing}`}
                aria-label={playLabel}
              >
                <Play className={`text-white/75 ${playIconSize}`} />
              </button>
            )}

            {!isMobile && (
              <span
                className={`hidden font-medium text-white/90 sm:inline ${
                  isTv ? "text-lg" : "text-sm md:text-base"
                }`}
              >
                {playLabel}
              </span>
            )}

            <button
              type="button"
              onClick={onInfoOpen}
              className={`flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/45 px-4 font-semibold text-white backdrop-blur-md transition hover:bg-black/60 ${secondaryBtn} ${focusRing} ${
                isTv ? "text-lg" : "text-sm sm:text-base"
              }`}
              aria-label="More information"
              title="More information"
            >
              {isMobile ? "More" : "More info"}
            </button>

            {isSubscriber && (
              <button
                type="button"
                onClick={() => void onToggleList()}
                className={`flex shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition ${secondaryBtn} ${focusRing} ${
                  inList
                    ? "border-orange-400/40 bg-orange-500/20 text-orange-100"
                    : "border-white/20 bg-black/45 text-white hover:bg-black/60"
                }`}
                aria-label={inList ? "Remove from My List" : "Add to My List"}
              >
                {inList ? (
                  <Check className={isTv ? "h-6 w-6" : "h-5 w-5"} />
                ) : (
                  <Plus className={isTv ? "h-6 w-6" : "h-5 w-5"} />
                )}
              </button>
            )}

            {trailerUrl && (
              <Link
                href={`/browse/content/${contentId}/watch?trailer=1`}
                onPointerDown={() => onPrepareTrailer?.()}
                onFocus={() => onPrepareTrailer?.()}
                className={`flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.08] text-white backdrop-blur-md transition hover:bg-white/12 ${focusRing} ${
                  isMobile
                    ? `${secondaryBtn}`
                    : "h-11 px-4 sm:h-12 sm:px-5"
                } ${isTv ? "h-14 px-6 text-base" : "text-xs font-semibold sm:text-sm"}`}
                aria-label="Watch trailer"
                title="Trailer"
              >
                {isMobile ? (
                  <Clapperboard className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <>Trailer</>
                )}
              </Link>
            )}
          </div>

          {isMobile && (
            <p className="mt-2 text-[11px] font-medium text-white/70">{playLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}
