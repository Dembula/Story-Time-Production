"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { EditReviewNote } from "@/lib/edit-review/types";
import { formatReviewTimecode } from "@/lib/edit-review/types";
import { cn } from "@/lib/utils";

export type EditReviewPlaybackHandle = {
  getCurrentTimeMs: () => number;
  seekToMs: (ms: number) => void;
  play: () => Promise<void>;
  pause: () => void;
};

type EditReviewPlayerProps = {
  src: string | null;
  notes: EditReviewNote[];
  onTimeUpdate?: (ms: number, durationMs: number) => void;
  onNoteMarkerClick?: (note: EditReviewNote) => void;
  className?: string;
};

export const EditReviewPlayer = forwardRef<EditReviewPlaybackHandle, EditReviewPlayerProps>(
  function EditReviewPlayer(
    { src, notes, onTimeUpdate, onNoteMarkerClick, className },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);

    useImperativeHandle(ref, () => ({
      getCurrentTimeMs: () => Math.round((videoRef.current?.currentTime ?? 0) * 1000),
      seekToMs: (ms: number) => {
        if (videoRef.current) videoRef.current.currentTime = ms / 1000;
      },
      play: async () => {
        await videoRef.current?.play();
        setPlaying(true);
      },
      pause: () => {
        videoRef.current?.pause();
        setPlaying(false);
      },
    }));

    const togglePlay = useCallback(async () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        await v.play();
        setPlaying(true);
      } else {
        v.pause();
        setPlaying(false);
      }
    }, []);

    const handleTimeUpdate = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      const ms = Math.round(v.currentTime * 1000);
      const dur = Math.round((v.duration || 0) * 1000);
      setCurrentMs(ms);
      if (dur > 0) setDurationMs(dur);
      onTimeUpdate?.(ms, dur);
    }, [onTimeUpdate]);

    const seekFromProgress = useCallback(
      (clientX: number, rect: DOMRect) => {
        const v = videoRef.current;
        if (!v || !durationMs) return;
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        v.currentTime = (durationMs / 1000) * ratio;
        handleTimeUpdate();
      },
      [durationMs, handleTimeUpdate],
    );

    useEffect(() => {
      setPlaying(false);
      setCurrentMs(0);
      setDurationMs(0);
    }, [src]);

    if (!src) {
      return (
        <div
          className={cn(
            "flex aspect-video items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/60",
            className,
          )}
        >
          <p className="text-sm text-slate-500">Upload an edit to start review</p>
        </div>
      );
    }

    const progress = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;
    const timedNotes = notes.filter((n) => n.timestampMs != null);

    return (
      <div className={cn("edit-review-player space-y-3", className)}>
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
          <video
            ref={videoRef}
            src={src}
            className="aspect-video w-full bg-black"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={() => void togglePlay()}
          />

          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-10">
            <div
              className="relative mb-2 h-1.5 cursor-pointer rounded-full bg-white/20"
              role="slider"
              aria-valuemin={0}
              aria-valuemax={durationMs}
              aria-valuenow={currentMs}
              onClick={(e) => seekFromProgress(e.clientX, e.currentTarget.getBoundingClientRect())}
              onKeyDown={() => {}}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-orange-400"
                style={{ width: `${progress}%` }}
              />
              {timedNotes.map((note) => {
                if (!note.timestampMs || !durationMs) return null;
                const left = (note.timestampMs / durationMs) * 100;
                return (
                  <button
                    key={note.id}
                    type="button"
                    title={note.body}
                    className="absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 bg-orange-300 shadow hover:scale-125"
                    style={{ left: `${left}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (note.timestampMs != null) {
                        videoRef.current!.currentTime = note.timestampMs / 1000;
                        handleTimeUpdate();
                      }
                      onNoteMarkerClick?.(note);
                    }}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-white">
              <button
                type="button"
                onClick={() => void togglePlay()}
                className="rounded p-1 hover:bg-white/10"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                }}
                className="rounded p-1 hover:bg-white/10"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <span className="font-mono text-xs text-slate-300">
                {formatReviewTimecode(currentMs)} / {formatReviewTimecode(durationMs || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
