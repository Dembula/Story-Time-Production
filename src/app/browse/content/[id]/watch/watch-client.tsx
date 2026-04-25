"use client";

import { useCallback, useRef } from "react";
import { FullscreenPlayer } from "@/components/player/fullscreen-player";
import { WatchPlayerErrorBoundary } from "@/components/player/watch-player-error-boundary";

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
};

export function WatchClient({
  content,
  contentDetailUrl,
  nextEpisode,
}: WatchClientProps) {
  const lastReportedRef = useRef(0);

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
    [content.id]
  );

  return (
    <WatchPlayerErrorBoundary
      src={content.videoUrl}
      poster={content.posterUrl || content.backdropUrl}
      title={content.title}
      contentDetailUrl={contentDetailUrl}
    >
      <FullscreenPlayer
        src={content.videoUrl}
        poster={content.posterUrl || content.backdropUrl}
        title={content.title}
        contentDetailUrl={contentDetailUrl}
        nextEpisode={nextEpisode}
        language={content.language}
        onTimeUpdate={reportWatchTime}
      />
    </WatchPlayerErrorBoundary>
  );
}
