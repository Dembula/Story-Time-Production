"use client";



import "@vidstack/react/player/styles/default/theme.css";

import "@vidstack/react/player/styles/default/layouts/video.css";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
} from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import { resolvePlaybackSources, type PlaybackSource } from "@/lib/playback-sources";
import { warmPlaybackManifest } from "@/lib/prefetch";
import {
  fetchPlaybackBundle,
  playbackBundleQueryKey,
  PLAYBACK_BUNDLE_STALE_MS,
} from "@/lib/prefetch/playback";
import {
  isStreamSignedPlaybackClientEnabled,
} from "@/lib/stream-playback-protection";
import { usePlaybackSession } from "@/lib/playback/session-store";
import { buildHlsDrmConfig } from "@/lib/content-capture-protection";
import type { PlaybackManifest } from "@/lib/playback/manifest-types";
import {
  buildHlsDrmConfigForSource,
  createFairPlayKeyHandler,
  detectDeviceDrmCapabilities,
  pickSupportedSource,
} from "@/lib/playback/client-drm";
import { prewarmFromManifest } from "@/lib/playback/instant-start";
import { PlaybackChrome } from "./playback-chrome";
import { PlaybackMetadataPanel } from "./playback-metadata-panel";
import { PlaybackComplianceBadge } from "./playback-compliance-badge";
import { NetflixMobileControls } from "./netflix-mobile-controls";
import { computePlaybackDeviceProfileClient } from "@/lib/player/mobile-detect";
import { StoryTimeLoader, StoryTimeLoaderOverlay } from "@/components/ui/storytime-loader";
import { PlaybackBufferingOverlay } from "./playback-buffering-overlay";
import { PLAYBACK_COMMAND_EVENT, type PlaybackCommand } from "@/lib/input/platform-events";



const INTRO_SKIP_SECONDS = 90;

const IDLE_HIDE_MS = 3200;


function actorList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}


type StorytimeMediaPlayerProps = {

  contentId: string;

  videoUrl: string;

  poster?: string | null;

  title: string;

  contentDetailUrl: string;

  nextEpisode: { id: string; title: string; href?: string } | null;

  startTime?: number;

  ageRating?: string | null;

  minAge?: number;

  advisory?: Record<string, unknown> | null;

  onTimeUpdate?: (currentTime: number, duration: number) => void;

  onProgressSave?: (currentTime: number, duration: number) => void;

  episodeId?: string | null;

  isTrailer?: boolean;

};



export function StorytimeMediaPlayer({

  contentId,

  videoUrl,

  poster,

  title,

  contentDetailUrl,

  nextEpisode,

  startTime = 0,

  ageRating = null,

  minAge = 0,

  advisory = null,

  onTimeUpdate,

  onProgressSave,

  episodeId = null,

  isTrailer = false,

}: StorytimeMediaPlayerProps) {

  const router = useRouter();

  const playerRef = useRef<MediaPlayerInstance>(null);

  const lastSavedRef = useRef(0);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [uiVisible, setUiVisible] = useState(true);

  const [metadataOpen, setMetadataOpen] = useState(false);

  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [deviceProfile, setDeviceProfile] = useState(computePlaybackDeviceProfileClient);
  const [userStartRequested, setUserStartRequested] = useState(false);
  const orientationLockedRef = useRef(false);
  const leaveWatchFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveWatchPopStateRef = useRef<(() => void) | null>(null);

  const setAmbientUiVisible = usePlaybackSession((s) => s.setAmbientUiVisible);
  const isMobileLike = deviceProfile.isMobileLike;



  const signedPlaybackRequired = isStreamSignedPlaybackClientEnabled();
  const fallbackSource = useMemo(() => resolvePlaybackSources(videoUrl), [videoUrl]);

  const { data: bundle, isLoading: bundleLoading, isError: bundleError } = useQuery({

    queryKey: playbackBundleQueryKey(contentId, episodeId, { trailer: isTrailer }),

    queryFn: () => fetchPlaybackBundle(contentId, episodeId, { trailer: isTrailer }),

    staleTime: signedPlaybackRequired ? PLAYBACK_BUNDLE_STALE_MS : 60_000,
    refetchOnWindowFocus: signedPlaybackRequired,

  });

  type PlaybackBundle = {
    playback?: PlaybackSource;
    manifest?: PlaybackManifest;
    scenes?: unknown;
    enrichment?: unknown;
    captureProtection?: { drmConfigured?: boolean; drmLicensePath?: string | null };
  };
  const typedBundle = bundle as PlaybackBundle | undefined;

  const manifest = useMemo(() => {
    const candidate = typedBundle?.manifest;
    return candidate && Array.isArray(candidate.sources) ? candidate : null;
  }, [typedBundle]);

  const deviceCaps = useMemo(() => detectDeviceDrmCapabilities(), []);
  const selectedManifestSource = useMemo(
    () => (manifest ? pickSupportedSource(manifest, deviceCaps) : null),
    [manifest, deviceCaps],
  );

  const source = useMemo((): PlaybackSource | null => {
    if (selectedManifestSource) {
      const t = selectedManifestSource.type;
      // Vidstack accepts `application/x-mpegurl`, `application/vnd.apple.mpegurl`,
      // `video/mp4`. Normalise to the keys it expects.
      const normalisedType: "application/x-mpegurl" | "video/mp4" =
        t === "video/mp4" || t === "video/webm" ? "video/mp4" : "application/x-mpegurl";
      return { src: selectedManifestSource.src, type: normalisedType };
    }
    const bundlePlayback = typedBundle?.playback;
    if (bundlePlayback?.src && bundlePlayback?.type) return bundlePlayback;
    if (signedPlaybackRequired) return null;
    return fallbackSource;
  }, [typedBundle, fallbackSource, selectedManifestSource, signedPlaybackRequired]);

  const missingSource = !source;
  const waitingForSignedBundle =
    signedPlaybackRequired && bundleLoading && !source && !bundle;



  const scenes = (typedBundle?.scenes ?? []) as Array<{

    id: string;

    startSeconds: number;

    endSeconds: number;

    summary: string | null;

    mood: string | null;

    actors: unknown;

  }>;



  const activeScene = scenes.find(

    (s) => currentTime >= s.startSeconds && currentTime < s.endSeconds,

  );
  const activeSceneActors = actorList(activeScene?.actors).slice(0, 5);

  const applyHlsDrmConfig = useCallback(
    (instance: unknown) => {
      const hls = instance as { config?: Record<string, unknown> } | null;
      if (!hls?.config) return;

      // 1) Preferred: per-source DRM from the unified manifest (Widevine /
      //    PlayReady descriptors built server-side with proxied license URLs).
      if (selectedManifestSource) {
        const drmConfig = buildHlsDrmConfigForSource(selectedManifestSource);
        if (drmConfig) {
          Object.assign(hls.config, drmConfig);
          return;
        }
      }

      // 2) Legacy single-system fallback (older bundles without `manifest`).
      const protection = (bundle as
        | { captureProtection?: { drmConfigured?: boolean; drmLicensePath?: string | null } }
        | undefined)?.captureProtection;
      if (!protection?.drmConfigured || !protection?.drmLicensePath) return;
      const licenseUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${protection.drmLicensePath}`
          : protection.drmLicensePath;
      const legacy = buildHlsDrmConfig({
        enabled: true,
        mode: "drm",
        drmLicenseUrl: licenseUrl,
        drmAuthToken: null,
        watermarkEnabled: true,
      });
      if (legacy) Object.assign(hls.config, legacy);
    },
    [bundle, selectedManifestSource],
  );

  // FairPlay native HLS handler — attaches to the underlying <video> element
  // when Apple browsers play encrypted HLS. The handler unwinds on unmount.
  useEffect(() => {
    const drm = selectedManifestSource?.drm;
    if (!drm || !drm.keySystem.startsWith("com.apple.fps")) return;
    const video = playerRef.current?.el?.querySelector("video") as HTMLVideoElement | null;
    if (!video) return;
    const handler = createFairPlayKeyHandler(drm);
    const detach = handler.attach(video);
    return () => {
      try { detach(); } catch { /* no-op */ }
    };
  }, [selectedManifestSource]);

  // Prewarm manifest, certificate and first segment as soon as we have
  // a manifest available so play() is instantaneous.
  useEffect(() => {
    if (manifest) prewarmFromManifest(manifest);
  }, [manifest]);



  useEffect(() => {
    const manifestUrl =
      typedBundle?.playback?.src ?? (signedPlaybackRequired ? null : videoUrl);
    if (manifestUrl) warmPlaybackManifest(manifestUrl);

    if (nextEpisode?.id) {
      const nextEpisodeId = nextEpisode.href?.includes("episode=")
        ? new URL(nextEpisode.href, "https://storytime.local").searchParams.get("episode")
        : null;
      void fetchPlaybackBundle(contentId, nextEpisodeId);
    }
  }, [videoUrl, nextEpisode?.id, nextEpisode?.href, contentId, typedBundle?.playback, signedPlaybackRequired]);



  const resetIdleTimer = useCallback(() => {

    setUiVisible(true);

    setAmbientUiVisible(true);

    if (idleTimer.current) clearTimeout(idleTimer.current);

    idleTimer.current = setTimeout(() => {

      setUiVisible(false);

      setAmbientUiVisible(false);

    }, IDLE_HIDE_MS);

  }, [setAmbientUiVisible]);



  useEffect(() => {

    resetIdleTimer();

    return () => {

      if (idleTimer.current) clearTimeout(idleTimer.current);

    };

  }, [resetIdleTimer]);



  const exitContainerFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      void document.exitFullscreen().catch(() => {});
    }
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => void;
    };
    if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
      try {
        doc.webkitExitFullscreen();
      } catch {
        // no-op
      }
    }
  }, []);

  const leaveWatch = useCallback(() => {
    exitContainerFullscreen();

    if (typeof window === "undefined") {
      router.replace(contentDetailUrl);
      return;
    }

    if (leaveWatchFallbackTimerRef.current) {
      clearTimeout(leaveWatchFallbackTimerRef.current);
      leaveWatchFallbackTimerRef.current = null;
    }
    if (leaveWatchPopStateRef.current) {
      window.removeEventListener("popstate", leaveWatchPopStateRef.current);
      leaveWatchPopStateRef.current = null;
    }

    const pathBefore = window.location.pathname;
    if (!pathBefore.includes("/watch")) {
      router.replace(contentDetailUrl);
      return;
    }

    const onPopState = () => {
      if (leaveWatchFallbackTimerRef.current) {
        clearTimeout(leaveWatchFallbackTimerRef.current);
        leaveWatchFallbackTimerRef.current = null;
      }
      window.removeEventListener("popstate", onPopState);
      leaveWatchPopStateRef.current = null;
    };
    leaveWatchPopStateRef.current = onPopState;
    window.addEventListener("popstate", onPopState);

    router.back();

    leaveWatchFallbackTimerRef.current = setTimeout(() => {
      leaveWatchFallbackTimerRef.current = null;
      window.removeEventListener("popstate", onPopState);
      leaveWatchPopStateRef.current = null;
      if (window.location.pathname === pathBefore) {
        router.replace(contentDetailUrl);
      }
    }, 700);
  }, [contentDetailUrl, exitContainerFullscreen, router]);



  const applyStartTime = useCallback(() => {

    const player = playerRef.current;

    if (!player || startTime <= 0) return;

    if (player.duration > 0 && startTime < player.duration - 5) {

      player.currentTime = startTime;

      setCurrentTime(startTime);

    }

  }, [startTime]);



  const skipIntro = useCallback(() => {

    const player = playerRef.current;

    if (!player) return;

    player.currentTime = INTRO_SKIP_SECONDS;

    setCurrentTime(INTRO_SKIP_SECONDS);

    setIntroSkipped(true);

  }, []);



  const seekTo = useCallback((seconds: number) => {

    const player = playerRef.current;

    if (!player) return;

    player.currentTime = seconds;

    setCurrentTime(seconds);

  }, []);



  const enterPiP = useCallback(async () => {

    const el = playerRef.current?.el;

    const video = el?.querySelector("video");

    if (!video || !document.pictureInPictureEnabled) return;

    try {

      if (document.pictureInPictureElement) {

        await document.exitPictureInPicture();

      } else {

        await video.requestPictureInPicture();

      }

    } catch {

      // unsupported or denied

    }

  }, []);

  const getVideoElement = useCallback(() => {
    return playerRef.current?.el?.querySelector("video") as
      | (HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
          webkitDisplayingFullscreen?: boolean;
          webkitSupportsFullscreen?: boolean;
        })
      | null;
  }, []);

  const configureVideoForDevice = useCallback(() => {
    const video = getVideoElement();
    if (!video) return null;
    if (deviceProfile.playsInline) {
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.playsInline = true;
    } else {
      video.removeAttribute("playsinline");
      video.removeAttribute("webkit-playsinline");
      video.playsInline = false;
    }
    video.preload = "auto";
    return video;
  }, [deviceProfile.playsInline, getVideoElement]);

  const requestNativeFullscreen = useCallback(async () => {
    const root = playerRef.current?.el?.closest(".storytime-watch-player") as HTMLElement | null;
    const video = configureVideoForDevice();
    if (!root && !video) return;
    try {
      if (deviceProfile.isIOS && video?.webkitEnterFullscreen && !video.webkitDisplayingFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (video?.requestFullscreen && deviceProfile.prefersNativeFullscreen) {
        await video.requestFullscreen();
        return;
      }
      if (root?.requestFullscreen) {
        await root.requestFullscreen();
      }
    } catch {
      // unsupported or denied
    }
  }, [configureVideoForDevice, deviceProfile.isIOS, deviceProfile.prefersNativeFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    await requestNativeFullscreen();
  }, [requestNativeFullscreen]);

  const startPlaybackFromGesture = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    setUserStartRequested(true);
    configureVideoForDevice();
    try {
      await player.play();
      await requestNativeFullscreen();
    } catch {
      // Browser policy may still require interaction with native controls.
    }
    resetIdleTimer();
  }, [configureVideoForDevice, requestNativeFullscreen, resetIdleTimer]);

  useEffect(() => {
    if (!source || isPlaying || userStartRequested || deviceProfile.canAutoplayAudible) return;
    const timer = window.setTimeout(() => {
      const player = playerRef.current;
      if (!player) return;
      setUserStartRequested(true);
      configureVideoForDevice();
      void player
        .play()
        .then(() => requestNativeFullscreen())
        .catch(() => {
          // Keep the native media controls available without adding an extra app-level play prompt.
        });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    configureVideoForDevice,
    deviceProfile.canAutoplayAudible,
    isPlaying,
    requestNativeFullscreen,
    source,
    userStartRequested,
  ]);

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused) {
      void startPlaybackFromGesture();
    } else {
      player.pause();
    }
    resetIdleTimer();
  }, [resetIdleTimer, startPlaybackFromGesture]);

  const seekBack = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, player.currentTime - 10);
    setCurrentTime(player.currentTime);
    resetIdleTimer();
  }, [resetIdleTimer]);

  const seekForward = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.currentTime = Math.min(player.duration || player.currentTime + 10, player.currentTime + 10);
    setCurrentTime(player.currentTime);
    resetIdleTimer();
  }, [resetIdleTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncDeviceProfile = () => setDeviceProfile(computePlaybackDeviceProfileClient());
    syncDeviceProfile();
    window.addEventListener("resize", syncDeviceProfile);
    window.addEventListener("orientationchange", syncDeviceProfile);
    return () => {
      window.removeEventListener("resize", syncDeviceProfile);
      window.removeEventListener("orientationchange", syncDeviceProfile);
    };
  }, []);

  useEffect(() => {
    if (isMobileLike || typeof document === "undefined") return;
    const enterFullscreen = () => {
      const root = document.querySelector(".storytime-watch-player") as HTMLElement | null;
      if (!root || document.fullscreenElement) return;
      const requestFs =
        root.requestFullscreen?.bind(root) ??
        (root as unknown as { webkitRequestFullscreen?: () => Promise<void> | void })
          .webkitRequestFullscreen?.bind(root);
      if (!requestFs) return;
      void Promise.resolve(requestFs()).catch(() => {});
    };
    const timer = window.setTimeout(enterFullscreen, 80);
    return () => window.clearTimeout(timer);
  }, [isMobileLike, source?.src]);

  useEffect(() => {
    if (!isMobileLike) return;
    const lockLandscape = async () => {
      if (typeof window === "undefined") return;
      const orientationApi = window.screen?.orientation as
        | (ScreenOrientation & {
            lock?: (orientation: "landscape" | "landscape-primary" | "landscape-secondary") => Promise<void>;
          })
        | undefined;
      if (!orientationApi?.lock) return;
      try {
        await orientationApi.lock("landscape");
        orientationLockedRef.current = true;
      } catch {
        // Requires user gesture on some browsers.
      }
    };
    if (isPlaying) void lockLandscape();
  }, [isMobileLike, isPlaying]);

  useEffect(() => {
    return () => {
      if (leaveWatchFallbackTimerRef.current) {
        clearTimeout(leaveWatchFallbackTimerRef.current);
      }
      if (typeof window !== "undefined" && leaveWatchPopStateRef.current) {
        window.removeEventListener("popstate", leaveWatchPopStateRef.current);
      }
      if (typeof window === "undefined") return;
      const orientationApi = window.screen?.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined;
      if (orientationLockedRef.current && orientationApi?.unlock) {
        try {
          orientationApi.unlock();
        } catch {
          // no-op
        }
      }
    };
  }, []);

  useEffect(() => {
    const onPlaybackCommand = (event: Event) => {
      const action = (event as CustomEvent<{ action: PlaybackCommand }>).detail?.action;
      const player = playerRef.current;
      const video = player?.el?.querySelector("video") as HTMLVideoElement | null;
      if (!action || !player) return;

      switch (action) {
        case "play_pause":
          if (player.paused) void startPlaybackFromGesture();
          else player.pause();
          resetIdleTimer();
          break;
        case "seek_back":
          player.currentTime = Math.max(0, player.currentTime - 10);
          resetIdleTimer();
          break;
        case "seek_forward":
          player.currentTime = Math.min(player.duration || player.currentTime + 10, player.currentTime + 10);
          resetIdleTimer();
          break;
        case "seek_back_large":
          player.currentTime = Math.max(0, player.currentTime - 30);
          resetIdleTimer();
          break;
        case "seek_forward_large":
          player.currentTime = Math.min(player.duration || player.currentTime + 30, player.currentTime + 30);
          resetIdleTimer();
          break;
        case "volume_up":
          if (video) {
            video.muted = false;
            video.volume = Math.min(1, video.volume + 0.05);
          }
          resetIdleTimer();
          break;
        case "volume_down":
          if (video) {
            video.muted = false;
            video.volume = Math.max(0, video.volume - 0.05);
          }
          resetIdleTimer();
          break;
        case "mute_toggle":
          if (video) video.muted = !video.muted;
          resetIdleTimer();
          break;
        case "fullscreen_toggle":
          void toggleFullscreen();
          resetIdleTimer();
          break;
        case "exit":
          leaveWatch();
          break;
      }
    };

    window.addEventListener(PLAYBACK_COMMAND_EVENT, onPlaybackCommand);
    return () => window.removeEventListener(PLAYBACK_COMMAND_EVENT, onPlaybackCommand);
  }, [leaveWatch, resetIdleTimer, startPlaybackFromGesture, toggleFullscreen]);



  if (waitingForSignedBundle) {
    return (
      <div className="relative fixed inset-0 z-[100] bg-black" data-input-scope="player">
        {poster ? (
          <Image src={poster} alt="" fill priority className="object-contain opacity-40" sizes="100vw" unoptimized={poster.startsWith("http")} />
        ) : null}
        <StoryTimeLoaderOverlay mode="viewport">
          <div className="flex flex-col items-center text-center">
            <StoryTimeLoader size="md" />
            <p className="mt-4 text-sm text-slate-300/90">Starting playback…</p>
          </div>
        </StoryTimeLoaderOverlay>
      </div>
    );
  }

  if (missingSource || !source) {

    return (

      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black p-8 text-center">

        <p className="mb-4 text-lg font-medium text-white">Video unavailable</p>

        <p className="mb-6 max-w-md text-sm text-slate-400">

          {bundleError && signedPlaybackRequired
            ? "Signed playback could not be established. Check your connection and try again."
            : "This title does not have a playable video yet. Try again later or choose another title."}

        </p>

        <Link

          href={contentDetailUrl}

          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"

        >

          Back to details

        </Link>

      </div>

    );

  }



  const showSkipIntro =
    !introSkipped && currentTime < INTRO_SKIP_SECONDS && duration > INTRO_SKIP_SECONDS + 30;



  const enrichment = typedBundle?.enrichment as
    | {
        moodTags?: string[];
        atmosphere?: string | null;
        narrativeJson?: {
          scriptAnalysis?: {
            used?: boolean;
            sourceType?: string | null;
            truncated?: boolean;
            error?: string | null;
          } | null;
        } | null;
      }
    | undefined;
  const scriptAnalysis = enrichment?.narrativeJson?.scriptAnalysis ?? null;

  return (
    <div
      className="storytime-watch-player fixed inset-0 z-[100] h-[100dvh] w-screen bg-black"
      data-input-scope="player"
      onMouseMove={resetIdleTimer}
      onTouchStart={resetIdleTimer}
      onClick={resetIdleTimer}
      onKeyDown={resetIdleTimer}
    >
      <MediaPlayer
        ref={playerRef}
        className="h-full w-full [&_video]:object-contain"
        title={title}
        src={{ src: source.src, type: source.type as "application/x-mpegurl" | "video/mp4" }}
        poster={poster || undefined}
        playsInline={deviceProfile.playsInline}
        autoPlay={deviceProfile.canAutoplayAudible}
        load="eager"
        onHlsInstance={applyHlsDrmConfig}
        onLoadedData={() => {
          configureVideoForDevice();
          applyStartTime();
        }}
        onPlay={() => {
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onDurationChange={() => {
          applyStartTime();
          const player = playerRef.current;
          if (player) setDuration(player.duration);
        }}
        onTimeUpdate={() => {
          const player = playerRef.current;
          if (!player) return;
          const t = player.currentTime;
          const d = player.duration;
          setCurrentTime(t);
          onTimeUpdate?.(t, d);
          if (nextEpisode && d > 0 && d - t <= 15 && d - t > 0.5) {
            setNextCountdown(Math.ceil(d - t));
          } else {
            setNextCountdown(null);
          }
          const pos = Math.floor(t);
          if (onProgressSave && pos - lastSavedRef.current >= 10) {
            lastSavedRef.current = pos;
            onProgressSave(t, d);
          }
        }}
        onEnd={() => {
          const player = playerRef.current;
          if (player && onProgressSave) {
            onProgressSave(player.currentTime, player.duration);
          }
          if (nextEpisode) {
            router.push(nextEpisode.href ?? `/browse/content/${nextEpisode.id}/watch`);
          }
        }}
      >
        <MediaProvider />
        <PlaybackBufferingOverlay />
        {!isMobileLike ? <DefaultVideoLayout icons={defaultLayoutIcons} /> : null}
      </MediaPlayer>

      {isMobileLike ? (
        <NetflixMobileControls
          visible={uiVisible}
          title={title}
          ageRating={ageRating}
          minAge={minAge}
          advisory={advisory}
          moodTags={enrichment?.moodTags}
          atmosphere={enrichment?.atmosphere}
          actorsOnScreen={activeSceneActors}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onClose={leaveWatch}
          onTogglePlay={togglePlayPause}
          onSeekBack={seekBack}
          onSeekForward={seekForward}
          onSeek={seekTo}
          showSkipIntro={!isTrailer && showSkipIntro}
          onSkipIntro={skipIntro}
          onFullscreen={requestNativeFullscreen}
        />
      ) : (
        <>
          <div
            className={`pointer-events-none absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-500 ${
              uiVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="pointer-events-auto flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={leaveWatch}
                    className="rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/10"
                  >
                    ← Back
                  </button>
                  <PlaybackComplianceBadge
                    ageRating={ageRating}
                    minAge={minAge}
                    advisory={advisory}
                    variant="playback"
                  />
                </div>
              </div>
              <p className="max-w-[40%] truncate pt-1 text-sm font-medium text-white/90">{title}</p>
            </div>
          </div>

          <PlaybackChrome
            visible={uiVisible}
            title={title}
            showSkipIntro={!isTrailer && showSkipIntro}
            onSkipIntro={skipIntro}
            onPiP={enterPiP}
            pipSupported={typeof document !== "undefined" && document.pictureInPictureEnabled}
            metadataOpen={metadataOpen}
            onToggleMetadata={() => setMetadataOpen((v) => !v)}
            metadataAvailable={!isTrailer}
            currentSceneLabel={
              isTrailer
                ? null
                : activeSceneActors.length > 0
                  ? `On screen: ${activeSceneActors.join(", ")}`
                  : activeScene?.summary ?? activeScene?.mood ?? null
            }
          />

          {!isTrailer ? (
            <PlaybackMetadataPanel
              open={metadataOpen}
              onClose={() => setMetadataOpen(false)}
              moodTags={enrichment?.moodTags}
              atmosphere={enrichment?.atmosphere}
              scriptAnalysis={scriptAnalysis}
              scenes={scenes}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          ) : null}

          {nextEpisode && uiVisible ? (
            <div className="pointer-events-none absolute bottom-36 left-0 right-0 z-10 flex justify-center p-4">
              <Link
                href={nextEpisode.href ?? `/browse/content/${nextEpisode.id}/watch`}
                className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-black/70 px-6 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition hover:bg-black/85"
              >
                {nextCountdown != null ? (
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-bold">
                      {nextCountdown}
                    </span>
                    Up next: {nextEpisode.title}
                  </>
                ) : (
                  <>Up next: {nextEpisode.title}</>
                )}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );

}


