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
  /** Same-origin MP4 bumper played in this same <video> before HLS (web/hls.js path). */
  bumperSrc?: string | null;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  /** When true, stall pauses must not auto-resume (user hit pause). */
  userPausedRef?: MutableRefObject<boolean>;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: () => void;
  onDurationChange?: () => void;
  onCanPlay?: () => void;
  onWaiting?: () => void;
  onError?: () => void;
  onHlsReady?: () => void;
  onEnded?: () => void;
  /** Fired when bumper finishes or is skipped and feature HLS is attached. */
  onBumperComplete?: () => void;
  /** Fired when bumper phase starts / ends — parent uses for Skip intro UI. */
  onBumperPhaseChange?: (active: boolean) => void;
  children?: ReactNode;
};

function resolvePlaybackUrl(src: string): string {
  if (typeof window === "undefined") return src;
  if (src.startsWith("/")) return `${window.location.origin}${src}`;
  return src;
}

/** Ensure feature HLS is not double-intro'd when we already played the MP4 bumper. */
function withIntroDisabled(src: string): string {
  try {
    const url = new URL(resolvePlaybackUrl(src));
    url.searchParams.set("intro", "0");
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}`;
    }
    return url.href;
  } catch {
    const join = src.includes("?") ? "&" : "?";
    return `${src}${join}intro=0`;
  }
}

/**
 * Desktop/laptop HLS — one <video> element for bumper MP4 then feature HLS.
 * Avoids Vidstack native <source> handoff and hls.js discontinuity blackouts.
 */
export const StorytimeDesktopHlsPlayer = forwardRef<
  StorytimePlaybackHandle,
  StorytimeDesktopHlsPlayerProps
>(function StorytimeDesktopHlsPlayer(
  {
    src,
    bumperSrc = null,
    poster,
    className,
    autoPlay = false,
    userPausedRef,
    onPlay,
    onPause,
    onTimeUpdate,
    onDurationChange,
    onCanPlay,
    onWaiting,
    onError,
    onHlsReady,
    onEnded,
    onBumperComplete,
    onBumperPhaseChange,
    children,
  },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const phaseRef = useRef<"bumper" | "feature">("feature");
  const skipBumperRef = useRef<(() => void) | null>(null);
  const callbacksRef = useRef({
    onError,
    onHlsReady,
    onBumperComplete,
    onBumperPhaseChange,
    autoPlay,
    userPausedRef,
  });
  callbacksRef.current = {
    onError,
    onHlsReady,
    onBumperComplete,
    onBumperPhaseChange,
    autoPlay,
    userPausedRef,
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
        if (!video) return;
        // Skip intro during bumper: jump into the feature.
        if (phaseRef.current === "bumper" && time >= 3) {
          skipBumperRef.current?.();
          return;
        }
        video.currentTime = time;
      },
      get paused() {
        return videoRef.current?.paused ?? true;
      },
      getVideoElement: () => videoRef.current,
      /** Skip the in-element bumper and start feature HLS immediately. */
      skipBumper: () => skipBumperRef.current?.(),
      isBumperPhase: () => phaseRef.current === "bumper",
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
    const featureUrl = withIntroDisabled(src);
    const sameOrigin =
      typeof window !== "undefined" &&
      resolvePlaybackUrl(featureUrl).startsWith(window.location.origin);

    const destroyHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    const attachFeatureHls = () => {
      if (destroyed) return;
      destroyHls();
      phaseRef.current = "feature";
      callbacksRef.current.onBumperPhaseChange?.(false);

      if (!Hls.isSupported()) {
        callbacksRef.current.onError?.();
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferHole: 0.5,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
        highBufferWatchdogPeriod: 1,
        xhrSetup: (xhr, url) => {
          if (sameOrigin && url.startsWith(window.location.origin)) {
            xhr.withCredentials = true;
          }
        },
      });
      hlsRef.current = hls;

      const resumeIfNeeded = () => {
        if (destroyed || callbacksRef.current.userPausedRef?.current) return;
        if (video.paused) void video.play().catch(() => {});
      };

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (destroyed) return;
        hls.loadSource(resolvePlaybackUrl(featureUrl));
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (destroyed) return;
        callbacksRef.current.onHlsReady?.();
        callbacksRef.current.onBumperComplete?.();
        if (callbacksRef.current.autoPlay || !callbacksRef.current.userPausedRef?.current) {
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
          resumeIfNeeded();
          return;
        }
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          resumeIfNeeded();
          return;
        }
        callbacksRef.current.onError?.();
      });
    };

    const startBumperThenFeature = () => {
      const bumper = bumperSrc?.trim();
      if (!bumper) {
        attachFeatureHls();
        return;
      }

      phaseRef.current = "bumper";
      callbacksRef.current.onBumperPhaseChange?.(true);
      destroyHls();
      video.removeAttribute("src");
      while (video.firstChild) video.removeChild(video.firstChild);
      // No poster during bumper — poster would hide the animation.
      video.removeAttribute("poster");
      video.src = resolvePlaybackUrl(bumper);
      video.load();

      const goFeature = () => {
        if (destroyed || phaseRef.current !== "bumper") return;
        video.removeEventListener("ended", onBumperEnded);
        video.pause();
        video.removeAttribute("src");
        video.load();
        attachFeatureHls();
      };

      const onBumperEnded = () => goFeature();
      skipBumperRef.current = goFeature;
      video.addEventListener("ended", onBumperEnded);

      // Watch is an explicit play gesture — start the bumper immediately.
      void video.play().catch(() => {});

      return () => {
        video.removeEventListener("ended", onBumperEnded);
      };
    };

    const bumperCleanup = startBumperThenFeature();

    return () => {
      destroyed = true;
      skipBumperRef.current = null;
      bumperCleanup?.();
      destroyHls();
      video.removeAttribute("src");
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();
    };
  }, [src, bumperSrc]);

  return (
    <div className={className}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={bumperSrc ? undefined : poster}
        playsInline
        disableRemotePlayback
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        onCanPlay={onCanPlay}
        onWaiting={onWaiting}
        onEnded={() => {
          // Bumper ended is handled inside the effect; feature ended bubbles up.
          if (phaseRef.current === "feature") onEnded?.();
        }}
      />
      {children}
    </div>
  );
});
