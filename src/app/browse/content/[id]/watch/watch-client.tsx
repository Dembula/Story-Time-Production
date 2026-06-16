"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { StorytimeMediaPlayer } from "@/components/player/storytime-media-player";
import { WatchPlayerErrorBoundary } from "@/components/player/watch-player-error-boundary";
import type { PlaybackSource } from "@/lib/playback-sources";
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
  offlineRequested?: boolean;
};

export function WatchClient({
  content,
  contentDetailUrl,
  nextEpisode,
  startTime = 0,
  episodeId = null,
  isTrailer = false,
  offlineRequested = false,
}: WatchClientProps) {
  const lastReportedRef = useRef(0);
  const lastSavedRef = useRef(0);
  const [offlineSource, setOfflineSource] = useState<string | null>(null);
  const [offlineReady, setOfflineReady] = useState(!offlineRequested);

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

  useEffect(() => {
    if (!offlineRequested) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setOfflineReady(false);
    void getOfflinePlaybackUrl(content.id)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setOfflineSource(url);
      })
      .finally(() => {
        if (!cancelled) setOfflineReady(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [content.id, offlineRequested]);

  if (offlineRequested && !offlineReady) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-6 text-center">
        <div>
          <p className="text-sm font-medium text-white">Preparing offline playback…</p>
          <p className="mt-2 text-xs text-slate-400">Checking downloaded files for this title.</p>
        </div>
      </div>
    );
  }

  if (offlineRequested && offlineReady && !offlineSource) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-6 text-center">
        <div className="max-w-md">
          <p className="text-lg font-semibold text-white">Offline file unavailable</p>
          <p className="mt-2 text-sm text-slate-400">
            This title is not downloaded on this device. Download it first, or continue with streaming playback.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/browse/downloads"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Open downloads
            </Link>
            <Link
              href={`/browse/content/${content.id}/watch`}
              className="rounded-lg border border-orange-400/40 bg-orange-500/20 px-4 py-2 text-sm font-medium text-orange-100 hover:bg-orange-500/30"
            >
              Stream online
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sourceOverride: PlaybackSource | null = offlineSource
    ? { src: offlineSource, type: "video/mp4" }
    : null;

  return (
    <WatchPlayerErrorBoundary
      src={content.videoUrl}
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
        sourceOverride={sourceOverride}
      />
    </WatchPlayerErrorBoundary>
  );
}
