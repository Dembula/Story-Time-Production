"use client";



import "@/lib/player/vidstack-hls";
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
  type MediaProviderAdapter,
} from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import { resolvePlaybackSources, isHlsPlaybackSource, requiresStreamPlaybackBundle, type PlaybackSource } from "@/lib/playback-sources";
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
import { hardenVideoElement } from "@/lib/content-capture-protection/video-hardening";
import { PlaybackMetadataPanel } from "./playback-metadata-panel";
import { PlaybackComplianceBadge } from "./playback-compliance-badge";
import { NetflixMobileControls } from "./netflix-mobile-controls";
import { PictureInPicture2, SkipForward, Sparkles } from "lucide-react";
import { computePlaybackDeviceProfileClient } from "@/lib/player/mobile-detect";
import { configureVidstackHlsProvider, isHlsJsSupported, usesInBrowserHlsEngine } from "@/lib/player/vidstack-hls";
import { configureAppleNativePlayer, usesAppleNativePlayer } from "@/lib/player/native-player-guard";
import { consumePlaybackPlayIntent } from "@/lib/player/play-intent";
import { createVidstackPlaybackHandle, type StorytimePlaybackHandle } from "@/lib/player/watch-playback-handle";
import { StorytimeDesktopHlsPlayer } from "./storytime-desktop-hls-player";
import {
  findActiveScene,
  formatActiveSceneLabel,
  parseSceneActors,
} from "@/lib/player/scene-intelligence";
import { leaveWatchRoute } from "@/lib/player/leave-watch";
import { StoryTimeLoader, StoryTimeLoaderOverlay } from "@/components/ui/storytime-loader";
import { PlaybackBufferingOverlay } from "./playback-buffering-overlay";
import { PLAYBACK_COMMAND_EVENT, type PlaybackCommand } from "@/lib/input/platform-events";



const INTRO_SKIP_SECONDS = 90;

const IDLE_HIDE_MS = 3200;


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
  const desktopPlaybackRef = useRef<StorytimePlaybackHandle>(null);

  const lastSavedRef = useRef(0);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [uiVisible, setUiVisible] = useState(true);

  const [metadataOpen, setMetadataOpen] = useState(false);

  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hlsLoadFailed, setHlsLoadFailed] = useState(false);
  const [hlsInstanceReady, setHlsInstanceReady] = useState(false);
  const [deviceProfile, setDeviceProfile] = useState(computePlaybackDeviceProfileClient);
  const [userStartRequested, setUserStartRequested] = useState(() => consumePlaybackPlayIntent());
  const orientationLockedRef = useRef(false);
  const watchShellRef = useRef<HTMLDivElement>(null);
  const leavingWatchRef = useRef(false);
  const appleNativeCleanupRef = useRef<(() => void) | null>(null);

  const setAmbientUiVisible = usePlaybackSession((s) => s.setAmbientUiVisible);
  const useTouchControls = deviceProfile.useTouchControls;
  const isMobileLike = deviceProfile.isMobileLike;



  const clientSignedPlaybackRequired = isStreamSignedPlaybackClientEnabled();
  const fallbackSource = useMemo(() => {
    const trimmed = videoUrl?.trim();
    if (!trimmed) return null;
    if (requiresStreamPlaybackBundle(trimmed)) return null;
    return resolvePlaybackSources(trimmed);
  }, [videoUrl]);

  const { data: bundle, isLoading: bundleLoading, isError: bundleError } = useQuery({

    queryKey: playbackBundleQueryKey(contentId, episodeId, { trailer: isTrailer }),

    queryFn: () => fetchPlaybackBundle(contentId, episodeId, { trailer: isTrailer }),

    staleTime: clientSignedPlaybackRequired ? PLAYBACK_BUNDLE_STALE_MS : 60_000,
    refetchOnWindowFocus: clientSignedPlaybackRequired,
    retry: 2,
    refetchInterval: (query) => {
      const intel = (query.state.data as { sceneIntelligence?: { pending?: boolean } } | undefined)
        ?.sceneIntelligence;
      if (intel?.pending) return 6_000;
      return false;
    },

  });

  const signedPlaybackRequired =
    clientSignedPlaybackRequired ||
    Boolean((bundle?.playbackProtection as { signedUrl?: boolean } | undefined)?.signedUrl);

  const requiresPlaybackBundle = useMemo(() => {
    return signedPlaybackRequired || requiresStreamPlaybackBundle(videoUrl);
  }, [signedPlaybackRequired, videoUrl]);

  const source = useMemo((): PlaybackSource | null => {
    const bundlePlayback = bundle?.playback as PlaybackSource | undefined;
    if (bundlePlayback?.src && bundlePlayback?.type) return bundlePlayback;
    if (signedPlaybackRequired) return null;
    return fallbackSource;
  }, [bundle?.playback, fallbackSource, signedPlaybackRequired]);

  const missingSource = !source;
  const needsHlsJs = isHlsPlaybackSource(source);
  const usesBrowserHls = usesInBrowserHlsEngine();
  const hlsJsUnsupported = needsHlsJs && usesBrowserHls && !isHlsJsSupported();
  const waitingForPlaybackBundle =
    requiresPlaybackBundle && bundleLoading && !source;

  const useDirectDesktopHls = usesBrowserHls && needsHlsJs && Boolean(source?.src);
  const waitingForHlsEngine = useDirectDesktopHls && !hlsInstanceReady;
  const blockAutoplayUntilHls = useDirectDesktopHls && !hlsInstanceReady;
  const showTouchStyleControls = useTouchControls || useDirectDesktopHls;

  const getPlayback = useCallback((): StorytimePlaybackHandle | null => {
    if (useDirectDesktopHls) return desktopPlaybackRef.current;
    return createVidstackPlaybackHandle(playerRef.current);
  }, [useDirectDesktopHls]);



  const scenes = (bundle?.scenes ?? []) as Array<{

    id: string;

    startSeconds: number;

    endSeconds: number;

    summary: string | null;

    mood: string | null;

    actors: unknown;

  }>;



  const activeScene = findActiveScene(scenes, currentTime);
  const activeSceneActors = parseSceneActors(activeScene?.actors).slice(0, 6);
  const activeSceneLabel = formatActiveSceneLabel(activeScene);
  const sceneIntelligencePending = Boolean(
    (bundle as { sceneIntelligence?: { pending?: boolean } } | undefined)?.sceneIntelligence?.pending,
  );

  const applyHlsDrmConfig = useCallback(
    (instance: unknown) => {
      setHlsInstanceReady(true);
      const protection = bundle?.captureProtection as
        | { drmConfigured?: boolean; drmLicensePath?: string | null }
        | undefined;
      if (!protection?.drmConfigured || !protection?.drmLicensePath) return;
      const hls = instance as { config?: Record<string, unknown> } | null;
      if (!hls?.config) return;
      const licenseUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${protection.drmLicensePath}`
          : protection.drmLicensePath;
      const drmConfig = buildHlsDrmConfig({
        enabled: true,
        mode: "drm",
        drmLicenseUrl: licenseUrl,
        drmAuthToken: null,
        watermarkEnabled: true,
      });
      if (drmConfig) Object.assign(hls.config, drmConfig);
    },
    [bundle?.captureProtection],
  );

  const handleProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
    configureVidstackHlsProvider(provider);
  }, []);

  const handleHlsLibLoadError = useCallback(() => {
    setHlsLoadFailed(true);
  }, []);

  useEffect(() => {
    setHlsLoadFailed(false);
    setHlsInstanceReady(false);
  }, [source?.src, source?.type]);

  const handleDesktopTimeUpdate = useCallback(() => {
    const player = getPlayback();
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
  }, [getPlayback, nextEpisode, onProgressSave, onTimeUpdate]);

  const handleDesktopEnded = useCallback(() => {
    const player = getPlayback();
    if (player && onProgressSave) {
      onProgressSave(player.currentTime, player.duration);
    }
    if (nextEpisode) {
      router.push(nextEpisode.href ?? `/browse/content/${nextEpisode.id}/watch`);
    }
  }, [getPlayback, nextEpisode, onProgressSave, router]);



  useEffect(() => {
    const manifestUrl = (bundle?.playback as PlaybackSource | undefined)?.src ?? null;
    if (manifestUrl?.startsWith("/api/")) warmPlaybackManifest(manifestUrl);

    if (nextEpisode?.id) {
      const nextEpisodeId = nextEpisode.href?.includes("episode=")
        ? new URL(nextEpisode.href, "https://storytime.local").searchParams.get("episode")
        : null;
      void fetchPlaybackBundle(contentId, nextEpisodeId);
    }
  }, [nextEpisode?.id, nextEpisode?.href, contentId, bundle?.playback]);



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

  const applyStartTime = useCallback(() => {

    const player = getPlayback();

    if (!player || startTime <= 0) return;

    if (player.duration > 0 && startTime < player.duration - 5) {

      player.setCurrentTime(startTime);

      setCurrentTime(startTime);

    }

  }, [getPlayback, startTime]);



  const skipIntro = useCallback(() => {

    const player = getPlayback();

    if (!player) return;

    player.setCurrentTime(INTRO_SKIP_SECONDS);

    setCurrentTime(INTRO_SKIP_SECONDS);

    setIntroSkipped(true);

  }, [getPlayback]);



  const seekTo = useCallback((seconds: number) => {

    const player = getPlayback();

    if (!player) return;

    player.setCurrentTime(seconds);

    setCurrentTime(seconds);

  }, [getPlayback]);



  const enterPiP = useCallback(async () => {

    const video = getPlayback()?.getVideoElement();

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

  }, [getPlayback]);

  const getVideoElement = useCallback(() => {
    return getPlayback()?.getVideoElement() as
      | (HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
          webkitDisplayingFullscreen?: boolean;
          webkitSupportsFullscreen?: boolean;
        })
      | null;
  }, [getPlayback]);

  const leaveWatch = useCallback(() => {
    if (leavingWatchRef.current) return;
    leavingWatchRef.current = true;

    void leaveWatchRoute(router, contentDetailUrl, {
      pause: () => {
        getPlayback()?.pause();
      },
      container: watchShellRef.current,
      video: getVideoElement(),
    }).finally(() => {
      leavingWatchRef.current = false;
    });
  }, [contentDetailUrl, getPlayback, getVideoElement, router]);

  const handleClosePlayer = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      leaveWatch();
    },
    [leaveWatch],
  );

  const configureVideoForDevice = useCallback(() => {
    const video = getVideoElement();
    if (!video) return null;

    appleNativeCleanupRef.current?.();
    appleNativeCleanupRef.current = null;

    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.playsInline = true;
    video.disableRemotePlayback = true;
    video.setAttribute("disableremoteplayback", "");
    video.preload = "auto";

    if (usesAppleNativePlayer()) {
      appleNativeCleanupRef.current = configureAppleNativePlayer(video);
    } else {
      hardenVideoElement(video);
    }

    return video;
  }, [getVideoElement]);

  useEffect(() => {
    return () => {
      appleNativeCleanupRef.current?.();
      appleNativeCleanupRef.current = null;
    };
  }, []);

  const requestNativeFullscreen = useCallback(async () => {
    const root = watchShellRef.current;
    configureVideoForDevice();
    if (!root) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await root.requestFullscreen();
    } catch {
      // unsupported or denied
    }
  }, [configureVideoForDevice]);

  const toggleFullscreen = useCallback(async () => {
    await requestNativeFullscreen();
  }, [requestNativeFullscreen]);

  const startPlaybackFromGesture = useCallback(async () => {
    const player = getPlayback();
    if (!player) return;
    setUserStartRequested(true);
    configureVideoForDevice();
    try {
      await player.play();
    } catch {
      // Browser policy may still require interaction with native controls.
    }
    resetIdleTimer();
  }, [configureVideoForDevice, getPlayback, resetIdleTimer]);

  useEffect(() => {
    if (!source || isPlaying || blockAutoplayUntilHls) return;
    if (!userStartRequested && !deviceProfile.canAutoplayAudible) return;

    const start = () => {
      const player = getPlayback();
      if (!player) return;
      configureVideoForDevice();
      void player.play().catch(() => {});
    };

    if (userStartRequested) {
      start();
      return;
    }

    const timer = window.setTimeout(start, 80);
    return () => window.clearTimeout(timer);
  }, [
    blockAutoplayUntilHls,
    configureVideoForDevice,
    deviceProfile.canAutoplayAudible,
    getPlayback,
    isPlaying,
    source,
    userStartRequested,
  ]);

  const togglePlayPause = useCallback(() => {
    const player = getPlayback();
    if (!player) return;
    if (player.paused) {
      void startPlaybackFromGesture();
    } else {
      player.pause();
    }
    resetIdleTimer();
  }, [getPlayback, resetIdleTimer, startPlaybackFromGesture]);

  const seekBack = useCallback(() => {
    const player = getPlayback();
    if (!player) return;
    player.setCurrentTime(Math.max(0, player.currentTime - 10));
    setCurrentTime(player.currentTime);
    resetIdleTimer();
  }, [getPlayback, resetIdleTimer]);

  const seekForward = useCallback(() => {
    const player = getPlayback();
    if (!player) return;
    player.setCurrentTime(Math.min(player.duration || player.currentTime + 10, player.currentTime + 10));
    setCurrentTime(player.currentTime);
    resetIdleTimer();
  }, [getPlayback, resetIdleTimer]);

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
      const player = getPlayback();
      const video = player?.getVideoElement() ?? null;
      if (!action || !player) return;

      switch (action) {
        case "play_pause":
          if (player.paused) void startPlaybackFromGesture();
          else player.pause();
          resetIdleTimer();
          break;
        case "seek_back":
          player.setCurrentTime(Math.max(0, player.currentTime - 10));
          resetIdleTimer();
          break;
        case "seek_forward":
          player.setCurrentTime(Math.min(player.duration || player.currentTime + 10, player.currentTime + 10));
          resetIdleTimer();
          break;
        case "seek_back_large":
          player.setCurrentTime(Math.max(0, player.currentTime - 30));
          resetIdleTimer();
          break;
        case "seek_forward_large":
          player.setCurrentTime(Math.min(player.duration || player.currentTime + 30, player.currentTime + 30));
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
  }, [getPlayback, leaveWatch, resetIdleTimer, startPlaybackFromGesture, toggleFullscreen]);



  if (waitingForHlsEngine) {
    return (
      <div className="relative fixed inset-0 z-[100] bg-black" data-input-scope="player">
        {poster ? (
          <Image src={poster} alt="" fill priority className="object-contain opacity-40" sizes="100vw" unoptimized={poster.startsWith("http")} />
        ) : null}
        <StoryTimeLoaderOverlay mode="viewport">
          <div className="flex flex-col items-center text-center">
            <StoryTimeLoader size="md" />
            <p className="mt-4 text-sm text-slate-300/90">Preparing stream…</p>
          </div>
        </StoryTimeLoaderOverlay>
      </div>
    );
  }

  if (waitingForPlaybackBundle) {
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

  if (hlsJsUnsupported || hlsLoadFailed) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black p-8 text-center">
        <p className="mb-4 text-lg font-medium text-white">Playback not supported in this browser</p>
        <p className="mb-6 max-w-md text-sm text-slate-400">
          {hlsLoadFailed
            ? "Video playback could not start in the browser. Try refreshing, or use Chrome or Edge on desktop."
            : "This browser cannot play adaptive streams. Please use Chrome, Edge, or Firefox on desktop, or Safari on Apple devices."}
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

  if (missingSource || !source) {

    return (

      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black p-8 text-center">

        <p className="mb-4 text-lg font-medium text-white">Video unavailable</p>

        <p className="mb-6 max-w-md text-sm text-slate-400">

          {bundleError && requiresPlaybackBundle
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



  const enrichment = bundle?.enrichment as
    | {
        moodTags?: string[];
        atmosphere?: string | null;
        pacing?: string | null;
        narrativeJson?: {
          summary?: string | null;
          scriptAnalysis?: {
            used?: boolean;
            sourceType?: string | null;
            truncated?: boolean;
            error?: string | null;
            label?: string | null;
          } | null;
          sceneSource?: string | null;
          scriptLabel?: string | null;
        } | null;
      }
    | undefined;
  const narrativeJson = enrichment?.narrativeJson;
  const scriptAnalysis =
    narrativeJson?.scriptAnalysis ??
    (narrativeJson?.sceneSource
      ? {
          used: narrativeJson.sceneSource !== "catalogue",
          sourceType: narrativeJson.sceneSource,
          label: narrativeJson.scriptLabel ?? null,
        }
      : null);
  const narrativeSummary =
    typeof narrativeJson?.summary === "string" ? narrativeJson.summary : null;
  const hasSceneIntelligence = scenes.length > 0 || sceneIntelligencePending;

  return (
    <div
      ref={watchShellRef}
      className="storytime-watch-player fixed inset-0 z-[100] h-[100dvh] w-screen bg-black"
      data-input-scope="player"
      onMouseMove={resetIdleTimer}
      onTouchStart={resetIdleTimer}
      onClick={resetIdleTimer}
      onKeyDown={resetIdleTimer}
    >
      {useDirectDesktopHls ? (
        <StorytimeDesktopHlsPlayer
          ref={desktopPlaybackRef}
          src={source.src}
          poster={poster || undefined}
          className="h-full w-full"
          autoPlay={deviceProfile.canAutoplayAudible && !blockAutoplayUntilHls}
          onHlsReady={() => {
            setHlsInstanceReady(true);
            applyStartTime();
          }}
          onError={() => setHlsLoadFailed(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onDurationChange={() => {
            applyStartTime();
            const player = getPlayback();
            if (player) setDuration(player.duration);
          }}
          onTimeUpdate={handleDesktopTimeUpdate}
          onEnded={handleDesktopEnded}
        />
      ) : (
      <MediaPlayer
        ref={playerRef}
        className="storytime-vidstack-player h-full w-full [&_video]:object-contain"
        title={title}
        src={{ src: source.src, type: source.type as "application/x-mpegurl" | "video/mp4" }}
        poster={poster || undefined}
        playsInline={true}
        preferNativeHLS={usesAppleNativePlayer()}
        autoPlay={deviceProfile.canAutoplayAudible && !blockAutoplayUntilHls}
        load="idle"
        onProviderChange={handleProviderChange}
        onHlsLibLoadError={handleHlsLibLoadError}
        onHlsInstance={applyHlsDrmConfig}
        onLoadedData={() => {
          configureVideoForDevice();
          applyStartTime();
        }}
        onCanPlay={() => {
          configureVideoForDevice();
          if (!usesInBrowserHlsEngine()) setHlsInstanceReady(true);
        }}
        onPlay={() => {
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onDurationChange={() => {
          applyStartTime();
          const player = getPlayback();
          if (player) setDuration(player.duration);
        }}
        onTimeUpdate={() => {
          handleDesktopTimeUpdate();
        }}
        onEnd={() => {
          handleDesktopEnded();
        }}
      >
        <MediaProvider />
        <PlaybackBufferingOverlay />
        {!showTouchStyleControls ? <DefaultVideoLayout icons={defaultLayoutIcons} /> : null}
      </MediaPlayer>
      )}

      {!useTouchControls && !isTrailer && activeSceneLabel && uiVisible ? (
        <div className="pointer-events-none absolute bottom-24 left-4 z-20 max-w-md">
          <div className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
            {activeSceneActors.length > 0 ? (
              <p className="text-[11px] font-semibold text-orange-200">
                On screen: {activeSceneActors.join(", ")}
              </p>
            ) : null}
            {activeScene?.summary ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] text-white/85">{activeScene.summary}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showTouchStyleControls ? (
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
            className={`pointer-events-none absolute left-0 right-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-500 ${
              uiVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="pointer-events-auto flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleClosePlayer}
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
                {!isTrailer && showSkipIntro ? (
                  <button
                    type="button"
                    onClick={skipIntro}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/10"
                  >
                    <SkipForward className="h-3.5 w-3.5" /> Skip intro
                  </button>
                ) : null}
                {!isTrailer ? (
                  <button
                    type="button"
                    onClick={() => setMetadataOpen((v) => !v)}
                    disabled={!hasSceneIntelligence}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-40 ${
                      metadataOpen
                        ? "border-orange-400/40 bg-orange-500/20 text-orange-100"
                        : "border-white/15 bg-black/50 text-white hover:bg-white/10"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Scene info
                  </button>
                ) : null}
                {typeof document !== "undefined" && document.pictureInPictureEnabled ? (
                  <button
                    type="button"
                    onClick={() => void enterPiP()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/10"
                    aria-label="Picture in picture"
                  >
                    <PictureInPicture2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="max-w-[40%] truncate pt-1 text-sm font-medium text-white/90">{title}</p>
            </div>
          </div>

          {!isTrailer ? (
            <PlaybackMetadataPanel
              open={metadataOpen}
              onClose={() => setMetadataOpen(false)}
              moodTags={enrichment?.moodTags}
              atmosphere={enrichment?.atmosphere}
              pacing={enrichment?.pacing}
              narrativeSummary={narrativeSummary}
              scriptAnalysis={scriptAnalysis}
              sceneIntelligencePending={sceneIntelligencePending}
              scenes={scenes}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          ) : null}

          {nextEpisode && uiVisible ? (
            <div className="pointer-events-none absolute bottom-28 left-0 right-0 z-20 flex justify-center p-4">
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


