"use client";

import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { WatchPlayerErrorBoundary } from "@/components/player/watch-player-error-boundary";

const StorytimeMediaPlayer = dynamic(
  () =>
    import("@/components/player/storytime-media-player").then((m) => ({
      default: m.StorytimeMediaPlayer,
    })),
  { ssr: false, loading: () => <WatchPageSkeleton /> },
);

function WatchPageSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex animate-pulse flex-col bg-black">
      <div className="h-14 bg-white/5" />
      <div className="flex-1 bg-white/[0.03]" />
    </div>
  );
}

type WatchClientProps = {
  content: {
    id: string;
    title: string;
    videoUrl: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    language: string | null;
    type: string | null;
  };
  contentDetailUrl: string;
  nextEpisode: { id: string; title: string } | null;
  startTime?: number;
};

export function WatchClient({
  content,
  contentDetailUrl,
  nextEpisode,
  startTime = 0,
}: WatchClientProps) {
  const lastReportedRef = useRef(0);
  const lastSavedRef = useRef(0);

  const reportWatchTime = useCallback(
    async (currentTime: number, _duration: number) => {
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
    [content.id],
  );

  const saveProgress = useCallback(
    async (currentTime: number, duration: number) => {
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
    [content.id],
  );

  return (
    <WatchPlayerErrorBoundary
      src={content.videoUrl}
      poster={content.posterUrl || content.backdropUrl}
      title={content.title}
      contentDetailUrl={contentDetailUrl}
    >
      <StorytimeMediaPlayer
        contentId={content.id}
        videoUrl={content.videoUrl}
        poster={content.posterUrl || content.backdropUrl}
        title={content.title}
        contentDetailUrl={contentDetailUrl}
        nextEpisode={nextEpisode}
        startTime={startTime}
        onTimeUpdate={reportWatchTime}
        onProgressSave={saveProgress}
      />
    </WatchPlayerErrorBoundary>
  );
}
