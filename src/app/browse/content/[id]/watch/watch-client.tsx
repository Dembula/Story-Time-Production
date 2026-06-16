"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StorytimeMediaPlayer } from "@/components/player/storytime-media-player";
import { WatchPlayerErrorBoundary } from "@/components/player/watch-player-error-boundary";
import { getOfflinePlaybackUrl } from "@/lib/offline/download-manager";

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
  const [offlineSrc, setOfflineSrc] = useState<string | null>(null);
  const [offlineLoading, setOfflineLoading] = useState(offlineMode);

  useEffect(() => {
    if (!offlineMode) return;
    let active = true;
    let objectUrl: string | null = null;
    void getOfflinePlaybackUrl(content.id).then((url) => {
      if (!active) return;
      objectUrl = url;
      setOfflineSrc(url);
      setOfflineLoading(false);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [content.id, offlineMode]);

  const reportWatchTime = useCallback(
    async (currentTime: number, _duration: number) => {
      if (isTrailer || offlineMode) return;
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
    [content.id, isTrailer, offlineMode],
  );

  const saveProgress = useCallback(
    async (currentTime: number, duration: number) => {
      if (isTrailer || offlineMode) return;
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
    [content.id, isTrailer, offlineMode],
  );

  if (offlineMode && offlineLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-sm text-slate-300">
        Loading offline copy…
      </div>
    );
  }

  if (offlineMode && !offlineSrc) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black p-8 text-center">
        <p className="mb-4 text-lg font-medium text-white">Offline copy unavailable</p>
        <p className="mb-6 max-w-md text-sm text-slate-400">
          Download this title from the film page before watching offline.
        </p>
        <a
          href={contentDetailUrl}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          Back to details
        </a>
      </div>
    );
  }

  return (
    <WatchPlayerErrorBoundary
      src={offlineSrc ?? content.videoUrl}
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
        offlineSrc={offlineSrc}
      />
    </WatchPlayerErrorBoundary>
  );
}
