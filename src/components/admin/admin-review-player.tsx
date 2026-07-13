"use client";

import { useEffect, useState } from "react";
import Hls from "hls.js";
import { StoryTimeLoader } from "@/components/ui/storytime-loader";
import type { PlaybackSource } from "@/lib/playback-sources";

type AdminReviewPlayerProps = {
  contentId: string;
  /** When true, preview the trailer instead of the main film. */
  trailer?: boolean;
  className?: string;
};

type PreviewPayload = {
  title?: string;
  posterUrl?: string | null;
  playback: PlaybackSource;
  error?: string;
};

/**
 * Lightweight admin review player — resolves unpublished titles via
 * `/api/admin/content/[id]/playback-preview` (Stream HLS or signed S3 MP4).
 */
export function AdminReviewPlayer({
  contentId,
  trailer = false,
  className = "w-full h-full",
}: AdminReviewPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);

    const qs = trailer ? "?trailer=1" : "";
    void fetch(`/api/admin/content/${contentId}/playback-preview${qs}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as PreviewPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok || !data.playback?.src) {
          setError(data.error || "Could not load review playback");
          return;
        }
        setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load review playback");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentId, trailer]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <StoryTimeLoader size="sm" />
      </div>
    );
  }

  if (error || !payload?.playback?.src) {
    return (
      <div className={`flex items-center justify-center bg-black px-6 text-center text-sm text-slate-400 ${className}`}>
        {error || "Playback unavailable"}
      </div>
    );
  }

  const { playback, posterUrl } = payload;
  const isHls = playback.type === "application/x-mpegurl";

  if (isHls) {
    return <HlsVideo src={playback.src} poster={posterUrl ?? undefined} className={className} />;
  }

  return (
    <video
      key={playback.src}
      src={playback.src}
      poster={posterUrl ?? undefined}
      controls
      autoPlay
      playsInline
      className={className}
    />
  );
}

function HlsVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoEl) return;

    if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = src;
      void videoEl.play().catch(() => null);
      return;
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
    });
    hls.loadSource(src);
    hls.attachMedia(videoEl);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void videoEl.play().catch(() => null);
    });

    return () => {
      hls.destroy();
    };
  }, [videoEl, src]);

  return (
    <video
      ref={setVideoEl}
      poster={poster}
      controls
      playsInline
      className={className}
    />
  );
}
