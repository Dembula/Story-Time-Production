"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  SkipForward,
  Play,
  Pause,
  Rewind,
  FastForward,
  Subtitles,
  Languages,
  ChevronDown,
} from "lucide-react";

const PLACEHOLDER_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const SEEK_SECONDS = 10;
const CONTROLS_HIDE_MS = 3000;

type FullscreenPlayerProps = {
  src: string;
  poster?: string | null;
  title: string;
  contentDetailUrl: string;
  nextEpisode: { id: string; title: string } | null;
  language?: string | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
};

export function FullscreenPlayer({
  src,
  poster,
  title,
  contentDetailUrl,
  nextEpisode,
  language,
  onTimeUpdate,
}: FullscreenPlayerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [subtitleOpen, setSubtitleOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [subtitleTrack, setSubtitleTrack] = useState<string>("off");
  const [audioTrack, setAudioTrack] = useState<string>(language || "en");

  const videoSrc = src || PLACEHOLDER_VIDEO;

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsEnded(false);
    } else {
      v.pause();
    }
  }, []);

  const seekBack = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - SEEK_SECONDS);
    setCurrentTime(v.currentTime);
  }, []);

  const seekForward = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration || 0, v.currentTime + SEEK_SECONDS);
    setCurrentTime(v.currentTime);
  }, []);

  const restart = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
    setIsEnded(false);
    setCurrentTime(0);
  }, []);

  const goBack = useCallback(() => {
    if (containerRef.current && document.fullscreenElement === containerRef.current) {
      document.exitFullscreen().catch(() => {});
    }
    router.push(contentDetailUrl);
  }, [contentDetailUrl, router]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
      hideControlsTimerRef.current = null;
    }, CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      const dur = v.duration;
      if (typeof dur === "number" && !Number.isNaN(dur)) setDuration(dur);
      onTimeUpdateRef.current?.(v.currentTime, dur);
    };
    const onDurationChange = () => setDuration(v.duration || 0);
    const onEnded = () => {
      setIsEnded(true);
      setIsPlaying(false);
      setControlsVisible(true);
    };
    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("durationchange", onDurationChange);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("durationchange", onDurationChange);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        container
          .requestFullscreen()
          .then(() => {
            const v = videoRef.current;
            if (v) v.play().catch(() => {});
          })
          .catch(() => {});
      }
    };

    enterFullscreen();

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        router.push(contentDetailUrl);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [contentDetailUrl, router]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onClick={showControls}
      onTouchEnd={(e) => {
        e.preventDefault();
        showControls();
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        poster={poster || undefined}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={(e) => {
          e.stopPropagation();
          togglePlayPause();
        }}
      />

      {/* Top bar: back */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors touch-manipulation"
            aria-label="Back to title"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-sm font-medium text-white/90 truncate max-w-[50%]">
            {title}
          </h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Center: play/pause on tap (handled by video onClick) — optional big play overlay when paused */}
      {!isPlaying && !isEnded && (
        <div
          className="absolute inset-0 flex items-center justify-center z-[5]"
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
        >
          <button
            type="button"
            className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors touch-manipulation"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <Play className="w-10 h-10 text-white fill-white ml-1" />
          </button>
        </div>
      )}

      {/* End card: restart + next episode */}
      {isEnded && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 z-20 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-lg font-medium">You finished this title.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={restart}
              className="flex items-center gap-2 px-5 py-3 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors touch-manipulation"
            >
              <RotateCcw className="w-5 h-5" />
              Start from beginning
            </button>
            {nextEpisode && (
              <Link
                href={`/browse/content/${nextEpisode.id}/watch`}
                className="flex items-center gap-2 px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors touch-manipulation"
              >
                <SkipForward className="w-5 h-5" />
                Next: {nextEpisode.title}
              </Link>
            )}
            <Link
              href={contentDetailUrl}
              className="flex items-center gap-2 px-5 py-3 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to title
            </Link>
          </div>
        </div>
      )}

      {/* Bottom: controls, progress, subtitles/audio */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 p-4 pb-6 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const v = videoRef.current;
              if (v) {
                const t = Number(e.target.value);
                v.currentTime = t;
                setCurrentTime(t);
              }
            }}
            className="w-full h-1.5 accent-orange-500 cursor-pointer touch-manipulation"
          />
          <div className="flex justify-between text-xs text-white/70 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayPause}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors touch-manipulation"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 fill-white ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={seekBack}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors touch-manipulation"
              aria-label="Rewind 10 seconds"
            >
              <Rewind className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={seekForward}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors touch-manipulation"
              aria-label="Forward 10 seconds"
            >
              <FastForward className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={restart}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors touch-manipulation"
              aria-label="Start from beginning"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {nextEpisode && (
              <Link
                href={`/browse/content/${nextEpisode.id}/watch`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors touch-manipulation"
              >
                <SkipForward className="w-5 h-5" />
                <span className="hidden sm:inline">Next</span>
              </Link>
            )}
            <span className="text-white/80 text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Subtitles */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSubtitleOpen((o) => !o);
                  setAudioOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm transition-colors touch-manipulation"
              >
                <Subtitles className="w-4 h-4" />
                <span>Subtitles</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {subtitleOpen && (
                <div className="absolute bottom-full right-0 mb-1 py-2 min-w-[140px] rounded-lg bg-slate-800 border border-slate-600 shadow-xl z-30">
                  {["off", "English"].map((track) => (
                    <button
                      key={track}
                      type="button"
                      onClick={() => {
                        setSubtitleTrack(track);
                        setSubtitleOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm transition-colors ${subtitleTrack === track ? "text-orange-400 bg-white/10" : "text-white/90 hover:bg-white/10"}`}
                    >
                      {track === "off" ? "Off" : track}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Audio / language */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAudioOpen((o) => !o);
                  setSubtitleOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm transition-colors touch-manipulation"
              >
                <Languages className="w-4 h-4" />
                <span>Audio</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {audioOpen && (
                <div className="absolute bottom-full right-0 mb-1 py-2 min-w-[140px] rounded-lg bg-slate-800 border border-slate-600 shadow-xl z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setAudioTrack("en");
                      setAudioOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${audioTrack === "en" ? "text-orange-400 bg-white/10" : "text-white/90 hover:bg-white/10"}`}
                  >
                    English
                  </button>
                  {language && language !== "en" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAudioTrack(language);
                        setAudioOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm transition-colors ${audioTrack === language ? "text-orange-400 bg-white/10" : "text-white/90 hover:bg-white/10"}`}
                    >
                      {language}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
