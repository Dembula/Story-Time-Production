"use client";

import { Maximize2, Minimize2, Pause, Play, Rewind, FastForward, X } from "lucide-react";
import { PlaybackComplianceBadge } from "./playback-compliance-badge";

const SEEK_SECONDS = 10;

type NetflixMobileControlsProps = {
  visible: boolean;
  title: string;
  ageRating?: string | null;
  minAge?: number;
  advisory?: Record<string, unknown> | null;
  moodTags?: string[] | null;
  atmosphere?: string | null;
  actorsOnScreen?: string[];
  isPlaying: boolean;
  isFullscreen?: boolean;
  currentTime: number;
  duration: number;
  onClose: () => void;
  onTogglePlay: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onSeek: (seconds: number) => void;
  showSkipIntro?: boolean;
  onSkipIntro?: () => void;
  onFullscreen?: () => void;
};

function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function stopControlEvent(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function NetflixMobileControls({
  visible,
  title,
  ageRating = null,
  minAge = 0,
  advisory = null,
  moodTags,
  atmosphere,
  actorsOnScreen = [],
  isPlaying,
  isFullscreen = false,
  currentTime,
  duration,
  onClose,
  onTogglePlay,
  onSeekBack,
  onSeekForward,
  onSeek,
  showSkipIntro,
  onSkipIntro,
  onFullscreen,
}: NetflixMobileControlsProps) {
  const remaining = Math.max(0, duration - currentTime);
  const tagLine = [
    ...(moodTags?.slice(0, 3) ?? []),
    atmosphere ? atmosphere : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {/* Top bar */}
      <div
        className={`absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-4 pb-10 pt-[max(env(safe-area-inset-top),0.75rem)] transition-opacity duration-300 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={stopControlEvent}
        onPointerDown={stopControlEvent}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <PlaybackComplianceBadge
                ageRating={ageRating}
                minAge={minAge}
                advisory={advisory}
                variant="playback"
              />
            </div>
            {tagLine ? (
              <p className="mt-1 line-clamp-2 text-[10px] font-medium uppercase tracking-wide text-white/55">
                {tagLine}
              </p>
            ) : null}
            {actorsOnScreen.length > 0 ? (
              <p className="mt-1 line-clamp-1 text-[11px] font-medium text-orange-100/80">
                On screen: {actorsOnScreen.slice(0, 4).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onFullscreen ? (
              <button
                type="button"
                onClick={(e) => {
                  stopControlEvent(e);
                  onFullscreen();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 touch-manipulation"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                stopControlEvent(e);
                onClose();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 touch-manipulation"
              aria-label="Close player"
            >
              <X className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>

      {/* Center transport */}
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center gap-10 px-6 transition-opacity duration-300 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={stopControlEvent}
        onPointerDown={stopControlEvent}
      >
        <button
          type="button"
          onClick={(e) => {
            stopControlEvent(e);
            onSeekBack();
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 touch-manipulation"
          aria-label={`Rewind ${SEEK_SECONDS} seconds`}
        >
          <Rewind className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            stopControlEvent(e);
            onTogglePlay();
          }}
          className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60 touch-manipulation"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-10 w-10 fill-white" />
          ) : (
            <Play className="ml-1 h-10 w-10 fill-white" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stopControlEvent(e);
            onSeekForward();
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 touch-manipulation"
          aria-label={`Forward ${SEEK_SECONDS} seconds`}
        >
          <FastForward className="h-7 w-7" />
        </button>
      </div>

      {/* Bottom scrubber */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-12 transition-opacity duration-300 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={stopControlEvent}
        onPointerDown={stopControlEvent}
      >
        {showSkipIntro && onSkipIntro ? (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                stopControlEvent(e);
                onSkipIntro();
              }}
              className="rounded-md border border-white/25 bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm touch-manipulation"
            >
              Skip intro
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer touch-manipulation accent-orange-500"
            aria-label="Playback position"
          />
          <span className="shrink-0 text-xs font-medium tabular-nums text-white/80">
            {formatRemaining(remaining)}
          </span>
        </div>
      </div>
    </>
  );
}
