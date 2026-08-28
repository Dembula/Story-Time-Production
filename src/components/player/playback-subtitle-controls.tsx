"use client";

import { Captions, Check } from "lucide-react";
import type { PlaybackSubtitleTrack } from "@/lib/subtitles/types";
import type { SubtitlePreference } from "./use-playback-subtitles";

type PlaybackSubtitleMenuProps = {
  tracks: PlaybackSubtitleTrack[];
  activeTrackId: SubtitlePreference;
  enabled: boolean;
  onSelect: (trackId: SubtitlePreference) => void;
  className?: string;
};

export function PlaybackSubtitleMenu({
  tracks,
  activeTrackId,
  enabled,
  onSelect,
  className = "",
}: PlaybackSubtitleMenuProps) {
  if (tracks.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-white/15 bg-black/85 p-2 text-sm text-white shadow-2xl backdrop-blur-md ${className}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
        Subtitles
      </p>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-white/10"
        onClick={() => onSelect("off")}
      >
        <span>Off</span>
        {!enabled ? <Check className="h-4 w-4 text-orange-300" /> : null}
      </button>
      {tracks.map((track) => (
        <button
          key={track.id}
          type="button"
          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-white/10"
          onClick={() => onSelect(track.id)}
        >
          <span>{track.label}</span>
          {enabled && activeTrackId === track.id ? (
            <Check className="h-4 w-4 text-orange-300" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

type PlaybackSubtitleToggleProps = {
  enabled: boolean;
  hasTracks: boolean;
  onToggleMenu: () => void;
  className?: string;
};

export function PlaybackSubtitleToggle({
  enabled,
  hasTracks,
  onToggleMenu,
  className = "",
}: PlaybackSubtitleToggleProps) {
  if (!hasTracks) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleMenu();
      }}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 ${
        enabled ? "text-orange-200" : ""
      } ${className}`}
      aria-label={enabled ? "Subtitles on" : "Subtitles off"}
      aria-pressed={enabled}
    >
      <Captions className="h-5 w-5" />
    </button>
  );
}
