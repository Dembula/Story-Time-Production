"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX, X } from "lucide-react";

type Props = {
  summaryId: string;
  title: string;
  open: boolean;
  onClose: () => void;
};

export function MeetRecordingPlayer(props: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const src = `/api/meet/summaries/${props.summaryId}/recording`;

  useEffect(() => {
    if (!props.open) return;
    setError(null);
    setReady(false);
    setPlaying(false);
    const el = videoRef.current;
    if (!el) return;
    el.load();
    void el.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [props.open, props.summaryId]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
      if (e.key === " ") {
        e.preventDefault();
        const el = videoRef.current;
        if (!el) return;
        if (el.paused) void el.play().then(() => setPlaying(true));
        else {
          el.pause();
          setPlaying(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Recording · ${props.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/85">
              Meet recording
            </p>
            <h2 className="truncate text-sm font-semibold text-white sm:text-base">{props.title}</h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            playsInline
            controls={false}
            preload="metadata"
            src={src}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedData={() => setReady(true)}
            onError={() => setError("Could not play this recording. Try again in a moment.")}
          />
          {!ready && !error ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Loading recording…
            </div>
          ) : null}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/8 px-3 py-3 sm:px-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-400"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) void el.play().then(() => setPlaying(true));
              else {
                el.pause();
                setPlaying(false);
              }
            }}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.08]"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              el.muted = !el.muted;
              setMuted(el.muted);
            }}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {muted ? "Unmute" : "Mute"}
          </button>
          <p className="ml-auto text-[11px] text-slate-500">
            Playback stays inside Story Time — no bucket link.
          </p>
        </div>
      </div>
    </div>
  );
}
