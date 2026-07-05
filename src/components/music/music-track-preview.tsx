"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Loader2, Pause, Play } from "lucide-react";
import {
  claimMusicPlayback,
  formatMusicTime,
  releaseMusicPlayback,
} from "@/lib/music-track-playback";

type MusicTrackPreviewProps = {
  audioUrl: string | null | undefined;
  trackId: string;
  title?: string;
  /** compact = list-row play button; bar = upload / expanded preview */
  variant?: "compact" | "bar";
  accent?: "pink" | "orange";
  className?: string;
  subtitle?: string;
};

const accentStyles = {
  pink: {
    button: "border-pink-500/40 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 hover:border-pink-500/60",
    buttonActive: "border-pink-500 bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]",
    progress: "bg-pink-500",
    progressTrack: "bg-slate-700/80",
  },
  orange: {
    button: "border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/60",
    buttonActive: "border-orange-500 bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.35)]",
    progress: "bg-orange-500",
    progressTrack: "bg-slate-700/80",
  },
} as const;

export function MusicTrackPreview({
  audioUrl,
  trackId,
  title,
  variant = "compact",
  accent = "pink",
  className = "",
  subtitle,
}: MusicTrackPreviewProps) {
  const instanceId = useId();
  const playerId = `${trackId}-${instanceId}`;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const styles = accentStyles[accent];
  const src = audioUrl?.trim() || null;
  const progressColor = accent === "pink" ? "rgb(236, 72, 153)" : "rgb(249, 115, 22)";

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
    setPlaying(false);
    releaseMusicPlayback(playerId);
  }, [playerId]);

  useEffect(() => {
    return () => {
      pause();
      releaseMusicPlayback(playerId);
    };
  }, [pause, playerId]);

  useEffect(() => {
    pause();
    setError(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [src, pause]);

  function togglePlay(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    if (!src) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      pause();
      return;
    }

    setLoading(true);
    setError(null);
    claimMusicPlayback(playerId, pause);

    void audio
      .play()
      .then(() => {
        setPlaying(true);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setPlaying(false);
        setError("Could not play audio. Check the file URL or try again.");
        releaseMusicPlayback(playerId);
      });
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration);
    setProgress((audio.currentTime / audio.duration) * 100);
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const next = (Number(e.target.value) / 100) * audio.duration;
    audio.currentTime = next;
    setCurrentTime(next);
    setProgress(Number(e.target.value));
  }

  if (!src) {
    if (variant === "compact") {
      return (
        <button
          type="button"
          disabled
          title="No audio file"
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/60 text-slate-600 ${className}`}
        >
          <Play className="h-4 w-4" />
        </button>
      );
    }
    return null;
  }

  const playButton = (
    <button
      type="button"
      onClick={togglePlay}
      disabled={loading}
      title={playing ? `Pause ${title ?? "track"}` : `Play ${title ?? "track"}`}
      aria-label={playing ? "Pause preview" : "Play preview"}
      className={`flex flex-shrink-0 items-center justify-center rounded-full border transition ${
        variant === "compact" ? "h-10 w-10" : "h-11 w-11"
      } ${playing ? styles.buttonActive : styles.button} ${loading ? "opacity-70" : ""} ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : playing ? (
        <Pause className="h-4 w-4 fill-current" />
      ) : (
        <Play className="h-4 w-4 fill-current" />
      )}
    </button>
  );

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onEnded={pause}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onError={() => {
          setLoading(false);
          setPlaying(false);
          setError("Audio failed to load.");
          releaseMusicPlayback(playerId);
        }}
      />

      {variant === "compact" ? (
        <div className="flex flex-col items-center gap-1">
          {playButton}
          {error ? (
            <span title={error} className="inline-flex">
              <AlertCircle className="h-3 w-3 text-red-400" aria-hidden />
            </span>
          ) : null}
        </div>
      ) : (
        <div className={`storytime-plan-card rounded-xl border border-white/10 bg-slate-900/50 p-3 ${className}`}>
          <div className="flex items-center gap-3">
            {playButton}
            <div className="min-w-0 flex-1">
              {title ? <p className="truncate text-sm font-medium text-white">{title}</p> : null}
              <div className="mt-2 flex items-center gap-2">
                <span className="w-9 text-[10px] tabular-nums text-slate-500">{formatMusicTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progress}
                  onChange={onSeek}
                  onClick={(e) => e.stopPropagation()}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700/80 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500"
                  style={{
                    background: `linear-gradient(to right, ${progressColor} ${progress}%, rgb(51 65 85 / 0.8) ${progress}%)`,
                  }}
                  aria-label="Seek preview"
                />
                <span className="w-9 text-right text-[10px] tabular-nums text-slate-500">
                  {formatMusicTime(duration)}
                </span>
              </div>
              {error ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              ) : subtitle ? (
                <p className="mt-1 text-[10px] text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
