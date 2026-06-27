"use client";

import "@/lib/player/vidstack-hls";
import { useCallback, useRef, useState } from "react";
import { StorytimeMediaPlayer } from "@/components/player/storytime-media-player";
import { WatchPlayerErrorBoundary } from "@/components/player/watch-player-error-boundary";
import { PlaybackXRayPanel } from "@/components/player/playback-xray-panel";

type WatchClientProps = {
  content: {
    id: string;
    title: string;
    videoUrl: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    language: string | null;
    type: string | null;
    ageRating: string | null;
    minAge: number;
    advisory: Record<string, unknown> | null;
  };
  contentDetailUrl: string;
  nextEpisode: { id: string; title: string; href?: string } | null;
  startTime?: number;
  episodeId?: string | null;
  isTrailer?: boolean;
};

export function WatchClient({
  content,
  contentDetailUrl,
  nextEpisode,
  startTime = 0,
  episodeId = null,
  isTrailer = false,
}: WatchClientProps) {
  const lastReportedRef = useRef(0);
  const lastSavedRef = useRef(0);
  const [playbackPosition, setPlaybackPosition] = useState(startTime);
  const [playbackDuration, setPlaybackDuration] = useState<number | null>(null);

  const reportWatchTime = useCallback(
    async (currentTime: number, _duration: number) => {
      if (isTrailer) return;
      setPlaybackPosition(Math.floor(currentTime));
      if (Number.isFinite(_duration) && _duration > 0) {
        setPlaybackDuration(Math.floor(_duration));
      }
      const elapsed = Math.floor(currentTime);
      const delta = elapsed - lastReportedRef.current;
      if (delta < 30) return;
      lastReportedRef.current = elapsed;
      try {
        await fetch("/api/watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentId: content.id,
            durationSeconds: delta,
          }),
        });
      } catch {
        // ignore
      }
    },
    [content.id, isTrailer],
  );

  const saveProgress = useCallback(
    async (currentTime: number, duration: number) => {
      if (isTrailer) return;
      const pos = Math.floor(currentTime);
      setPlaybackPosition(pos);
      if (Number.isFinite(duration) && duration > 0) {
        setPlaybackDuration(Math.floor(duration));
      }
      if (pos - lastSavedRef.current < 8 && pos > 0) return;
      lastSavedRef.current = pos;
      try {
        await fetch("/api/watch/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentId: content.id,
            positionSeconds: pos,
            durationSeconds: Number.isFinite(duration) ? Math.floor(duration) : undefined,
          }),
        });
      } catch {
        // ignore
      }
    },
    [content.id, isTrailer],
  );

  return (
    <WatchPlayerErrorBoundary
      src={content.videoUrl}
      poster={content.posterUrl || content.backdropUrl}
      title={content.title}
      contentDetailUrl={contentDetailUrl}
    >
      <div className="relative h-full w-full">
        <StorytimeMediaPlayer
          contentId={content.id}
          episodeId={episodeId}
          videoUrl={content.videoUrl}
          poster={content.posterUrl || content.backdropUrl}
          title={content.title}
          contentDetailUrl={contentDetailUrl}
          nextEpisode={nextEpisode}
          startTime={isTrailer ? 0 : startTime}
          ageRating={content.ageRating}
          minAge={content.minAge}
          advisory={content.advisory}
          onTimeUpdate={isTrailer ? undefined : reportWatchTime}
          onProgressSave={isTrailer ? undefined : saveProgress}
          isTrailer={isTrailer}
        />
        {!isTrailer && (
          <PlaybackXRayPanel
            contentId={content.id}
            positionSeconds={playbackPosition}
            durationSeconds={playbackDuration}
          />
        )}
      </div>
    </WatchPlayerErrorBoundary>
  );
}
