"use client";

import { Maximize2, Minimize2, Pause, Play, Rewind, FastForward } from "lucide-react";

const SEEK_SECONDS = 10;

type StorytimeDesktopPlaybackBarProps = {
  visible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isFullscreen?: boolean;
  onTogglePlay: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onSeek: (seconds: number) => void;
  onFullscreen?: () => void;
};

function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Bottom transport bar for desktop hls.js playback (no Vidstack layout). */
export function StorytimeDesktopPlaybackBar({
  visible,
  isPlaying,
  currentTime,
  duration,
  isFullscreen = false,
  onTogglePlay,
  onSeekBack,
  onSeekForward,
  onSeek,
  onFullscreen,
}: StorytimeDesktopPlaybackBarProps) {
  const remaining = Math.max(0, duration - currentTime);

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-4 pb-4 pt-16 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSeekBack();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            aria-label={`Rewind ${SEEK_SECONDS} seconds`}
          >
            <Rewind className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-white" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-white" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSeekForward();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            aria-label={`Forward ${SEEK_SECONDS} seconds`}
          >
            <FastForward className="h-5 w-5" />
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-orange-500"
          aria-label="Playback position"
        />

        <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-white/80">
          {formatRemaining(remaining)}
        </span>

        {onFullscreen ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFullscreen();
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
