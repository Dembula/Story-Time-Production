"use client";



import "@vidstack/react/player/styles/default/theme.css";

import "@vidstack/react/player/styles/default/layouts/video.css";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
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
import { useCaptureProtectedPlayback } from "@/hooks/use-capture-protected-playback";
import { PlaybackChrome } from "./playback-chrome";
import { PlaybackMetadataPanel } from "./playback-metadata-panel";
import { ForensicWatermark } from "./forensic-watermark";
import { CaptureProtectionBadge } from "./capture-protection-badge";
import { PlaybackComplianceBadge } from "./playback-compliance-badge";
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

  const setAmbientUiVisible = usePlaybackSession((s) => s.setAmbientUiVisible);
  const { data: session } = useSession();
  const capture = useCaptureProtectedPlayback({ contentId, playerRef });

  const watermarkLabel = useMemo(() => {
    const userId = session?.user?.id;
    const token = userId ? userId.slice(-8) : contentId.slice(-8);
    return `STORYTIME ${token.toUpperCase()}`;
  }, [session?.user?.id, contentId]);



  const signedPlaybackRequired = isStreamSignedPlaybackClientEnabled();
  const fallbackSource = useMemo(() => resolvePlaybackSources(videoUrl), [videoUrl]);

  const { data: bundle, isLoading: bundleLoading, isError: bundleError } = useQuery({

    queryKey: playbackBundleQueryKey(contentId, episodeId),

    queryFn: () => fetchPlaybackBundle(contentId, episodeId),

    staleTime: signedPlaybackRequired ? PLAYBACK_BUNDLE_STALE_MS : 60_000,
    refetchOnWindowFocus: signedPlaybackRequired,

  });

  const source = useMemo((): PlaybackSource | null => {
    const bundlePlayback = bundle?.playback as PlaybackSource | undefined;
    if (bundlePlayback?.src && bundlePlayback?.type) return bundlePlayback;
    if (signedPlaybackRequired) return null;
    return fallbackSource;
  }, [bundle?.playback, fallbackSource, signedPlaybackRequired]);

  const missingSource = !source;
  const waitingForSignedBundle =
    signedPlaybackRequired && bundleLoading && !source && !bundle;



  const scenes = (bundle?.scenes ?? []) as Array<{

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

  const applyHlsDrmConfig = useCallback(
    (instance: unknown) => {
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



  useEffect(() => {
    const manifestUrl =
      (bundle?.playback as PlaybackSource | undefined)?.src ??
      (signedPlaybackRequired ? null : videoUrl);
    if (manifestUrl) warmPlaybackManifest(manifestUrl);

    if (nextEpisode?.id) {
      const nextEpisodeId = nextEpisode.href?.includes("episode=")
        ? new URL(nextEpisode.href, "https://storytime.local").searchParams.get("episode")
        : null;
      void fetchPlaybackBundle(contentId, nextEpisodeId);
    }
  }, [videoUrl, nextEpisode?.id, nextEpisode?.href, contentId, bundle?.playback, signedPlaybackRequired]);



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



  const leaveWatch = useCallback(() => {

    router.replace(contentDetailUrl);

  }, [contentDetailUrl, router]);



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

  const toggleFullscreen = useCallback(async () => {
    const root = playerRef.current?.el?.closest(".capture-protected-player") as HTMLElement | null;
    if (!root) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      // unsupported or denied
    }
  }, []);

  useEffect(() => {
    const onPlaybackCommand = (event: Event) => {
      const action = (event as CustomEvent<{ action: PlaybackCommand }>).detail?.action;
      const player = playerRef.current;
      const video = player?.el?.querySelector("video") as HTMLVideoElement | null;
      if (!action || !player) return;

      switch (action) {
        case "play_pause":
          if (player.paused) void player.play();
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
  }, [leaveWatch, resetIdleTimer, toggleFullscreen]);



  if (waitingForSignedBundle) {
    return (
      <div className="relative fixed inset-0 z-50 bg-black" data-input-scope="player">
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

      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-8 text-center">

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



  return (

    <div
      className="capture-protected-player fixed inset-0 z-50 bg-black"
      data-input-scope="player"
      onMouseMove={resetIdleTimer}
      onTouchStart={resetIdleTimer}
      onKeyDown={resetIdleTimer}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MediaPlayer
        ref={playerRef}
        className="h-full w-full"
        title={title}
        src={{ src: source.src, type: source.type as "application/x-mpegurl" | "video/mp4" }}
        poster={poster || undefined}
        playsInline
        autoPlay
        load="eager"
        onHlsInstance={applyHlsDrmConfig}
        onLoadedData={applyStartTime}

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

        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>

      <ForensicWatermark
        label={watermarkLabel}
        visible={capture.active && capture.watermarkEnabled}
      />
      <CaptureProtectionBadge
        active={capture.active}
        drmConfigured={capture.drmConfigured || Boolean(bundle?.captureProtection?.drmConfigured)}
        screenCaptured={capture.screenCaptured}
        signedUrl={Boolean(bundle?.playbackProtection?.signedUrl)}
      />



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

        showSkipIntro={showSkipIntro}

        onSkipIntro={skipIntro}

        onPiP={enterPiP}

        pipSupported={typeof document !== "undefined" && document.pictureInPictureEnabled}

        metadataOpen={metadataOpen}

        onToggleMetadata={() => setMetadataOpen((v) => !v)}

        currentSceneLabel={activeScene?.summary ?? activeScene?.mood ?? null}

      />



      <PlaybackMetadataPanel

        open={metadataOpen}

        onClose={() => setMetadataOpen(false)}

        moodTags={bundle?.enrichment?.moodTags}

        atmosphere={bundle?.enrichment?.atmosphere}

        scenes={scenes}

        currentTime={currentTime}

        onSeek={seekTo}

      />



      {nextEpisode && uiVisible && (
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
      )}

    </div>

  );

}


