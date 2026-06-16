"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StorytimeMediaPlayer } from "@/components/player/storytime-media-player";
import { WatchPlayerErrorBoundary } from "@/components/player/watch-player-error-boundary";
import { getOfflinePlaybackUrl } from "@/lib/offline/download-manager";
import { isStreamSignedPlaybackClientEnabled } from "@/lib/stream-playback-protection";

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
  offlineMode?: boolean;
};

export function WatchClient({
  content,
  contentDetailUrl,
  nextEpisode,
  startTime = 0,
  episodeId = null,
  isTrailer = false,
  offlineMode = false,
}: WatchClientProps) {
  const lastReportedRef = useRef(0);
  const lastSavedRef = useRef(0);
  const [offlinePlaybackUrl, setOfflinePlaybackUrl] = useState<string | null>(null);
  const [offlineResolved, setOfflineResolved] = useState(!offlineMode);

  useEffect(() => {
    if (!offlineMode) {
      setOfflineResolved(true);
      setOfflinePlaybackUrl(null);
      return;
    }

    let revokedUrl: string | null = null;
    let cancelled = false;
    setOfflineResolved(false);
    setOfflinePlaybackUrl(null);

    void getOfflinePlaybackUrl(content.id)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        revokedUrl = url;
        setOfflinePlaybackUrl(url);
      })
      .finally(() => {
        if (!cancelled) setOfflineResolved(true);
      });

    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [content.id, offlineMode]);

  const safeFallbackSrc = offlineMode
    ? offlinePlaybackUrl
    : isStreamSignedPlaybackClientEnabled()
      ? null
      : content.videoUrl;

  const reportWatchTime = useCallback(
    async (currentTime: number, _duration: number) => {
      if (isTrailer) return;
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
      fallbackSrc={safeFallbackSrc}
      poster={content.posterUrl || content.backdropUrl}
      title={content.title}
      contentDetailUrl={contentDetailUrl}
    >
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
        offlineMode={offlineMode}
        offlinePlaybackUrl={offlinePlaybackUrl}
        offlineResolved={offlineResolved}
      />
    </WatchPlayerErrorBoundary>
  );
}
