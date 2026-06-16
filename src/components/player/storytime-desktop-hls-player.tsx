"use client";

import Hls from "hls.js";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import type { StorytimePlaybackHandle } from "@/lib/player/watch-playback-handle";
import { hardenVideoElement } from "@/lib/content-capture-protection/video-hardening";

type StorytimeDesktopHlsPlayerProps = {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: () => void;
  onDurationChange?: () => void;
  onCanPlay?: () => void;
  onWaiting?: () => void;
  onError?: () => void;
  onHlsReady?: () => void;
  onEnded?: () => void;
  children?: ReactNode;
};

/**
 * Desktop/laptop HLS — hls.js attached to a plain `<video>` with no `.m3u8` in `src`.
 * Avoids Vidstack native `<source>` handoff to Windows Media Player.
 */
export const StorytimeDesktopHlsPlayer = forwardRef<
  StorytimePlaybackHandle,
  StorytimeDesktopHlsPlayerProps
>(function StorytimeDesktopHlsPlayer(
  {
    src,
    poster,
    className,
    autoPlay = false,
    onPlay,
    onPause,
    onTimeUpdate,
    onDurationChange,
    onCanPlay,
    onWaiting,
    onError,
    onHlsReady,
    onEnded,
    children,
  },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      play: async () => {
        const video = videoRef.current;
        if (!video) return;
        await video.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
      get currentTime() {
        return videoRef.current?.currentTime ?? 0;
      },
      get duration() {
        return videoRef.current?.duration ?? 0;
      },
      setCurrentTime(time: number) {
        const video = videoRef.current;
        if (video) video.currentTime = time;
      },
      get paused() {
        return videoRef.current?.paused ?? true;
      },
      getVideoElement: () => videoRef.current,
    }),
    [],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    hardenVideoElement(video);
    video.playsInline = true;
    video.preload = "auto";

    let destroyed = false;

    if (!Hls.isSupported()) {
      onError?.();
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
    });
    hlsRef.current = hls;

    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      if (destroyed) return;
      hls.loadSource(src);
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (destroyed) return;
      onHlsReady?.();
      if (autoPlay) {
        void video.play().catch(() => {});
      }
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) onError?.();
    });

    return () => {
      destroyed = true;
      hls.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();
    };
  }, [src, autoPlay, onError, onHlsReady]);

  return (
    <div className={className}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={poster}
        playsInline
        disableRemotePlayback
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        onCanPlay={onCanPlay}
        onWaiting={onWaiting}
        onEnded={onEnded}
      />
      {children}
    </div>
  );
});
