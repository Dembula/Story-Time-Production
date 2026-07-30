"use client";

import Hls from "hls.js";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { StorytimePlaybackHandle } from "@/lib/player/watch-playback-handle";
import { hardenVideoElement } from "@/lib/content-capture-protection/video-hardening";

type StorytimeDesktopHlsPlayerProps = {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  /** When true, stall/discontinuity pauses must not auto-resume (user hit pause). */
  userPausedRef?: MutableRefObject<boolean>;
  /** Bumper end time — used to nudge past the intro→feature MSE gap. */
  discontinuityAtSeconds?: number;
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

function resolvePlaybackUrl(src: string): string {
  if (typeof window === "undefined") return src;
  if (src.startsWith("/")) return `${window.location.origin}${src}`;
  return src;
}

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
    userPausedRef,
    discontinuityAtSeconds,
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
  const callbacksRef = useRef({
    onError,
    onHlsReady,
    autoPlay,
    userPausedRef,
    discontinuityAtSeconds,
  });
  callbacksRef.current = {
    onError,
    onHlsReady,
    autoPlay,
    userPausedRef,
    discontinuityAtSeconds,
  };

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
    const playbackUrl = resolvePlaybackUrl(src);
    const sameOrigin =
      typeof window !== "undefined" && playbackUrl.startsWith(window.location.origin);

    if (!Hls.isSupported()) {
      callbacksRef.current.onError?.();
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      // Bumper → feature discontinuity often leaves a small MSE gap; jump it.
      maxBufferHole: 1.5,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 10,
      highBufferWatchdogPeriod: 1,
      xhrSetup: (xhr, url) => {
        if (sameOrigin && url.startsWith(window.location.origin)) {
          xhr.withCredentials = true;
        }
      },
    });
    hlsRef.current = hls;

    const resumeAfterDiscontinuityGap = () => {
      if (destroyed) return;
      if (callbacksRef.current.userPausedRef?.current) return;
      const edge = callbacksRef.current.discontinuityAtSeconds;
      if (typeof edge === "number" && edge > 0) {
        const t = video.currentTime;
        // Stuck on the bumper→feature handoff: jump just past the gap.
        if (t >= edge - 0.45 && t < edge + 0.35) {
          video.currentTime = edge + 0.05;
        }
      }
      if (video.paused) {
        void video.play().catch(() => {});
      }
    };

    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      if (destroyed) return;
      hls.loadSource(playbackUrl);
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (destroyed) return;
      callbacksRef.current.onHlsReady?.();
      if (callbacksRef.current.autoPlay) {
        void video.play().catch(() => {});
      }
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (
        !data.fatal &&
        (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
          data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE ||
          data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL)
      ) {
        resumeAfterDiscontinuityGap();
        return;
      }
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        resumeAfterDiscontinuityGap();
        return;
      }
      callbacksRef.current.onError?.();
    });

    video.addEventListener("waiting", resumeAfterDiscontinuityGap);
    video.addEventListener("stalled", resumeAfterDiscontinuityGap);

    return () => {
      destroyed = true;
      video.removeEventListener("waiting", resumeAfterDiscontinuityGap);
      video.removeEventListener("stalled", resumeAfterDiscontinuityGap);
      hls.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();
    };
  }, [src]);

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
