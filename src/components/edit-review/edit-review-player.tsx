"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Hls from "hls.js";
import { Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
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

function isHlsUrl(url: string) {
  return /\.m3u8(\?|$)/i.test(url) || url.includes("videodelivery.net") || url.includes("cloudflarestream.com");
}

export const EditReviewPlayer = forwardRef<EditReviewPlaybackHandle, EditReviewPlayerProps>(
  function EditReviewPlayer(
    { src, notes, onTimeUpdate, onNoteMarkerClick, className },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const pendingSeekMs = useRef<number | null>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [ready, setReady] = useState(false);
    const [buffering, setBuffering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTimeUpdate = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      const ms = Math.round(v.currentTime * 1000);
      const dur = Math.round((Number.isFinite(v.duration) ? v.duration : 0) * 1000);
      setCurrentMs(ms);
      if (dur > 0) setDurationMs(dur);
      onTimeUpdate?.(ms, dur);
    }, [onTimeUpdate]);

    const applySeek = useCallback(
      (ms: number) => {
        const v = videoRef.current;
        if (!v) return;
        const seconds = Math.max(0, ms / 1000);
        const apply = () => {
          try {
            v.currentTime = seconds;
          } catch {
            pendingSeekMs.current = ms;
            return;
          }
          const sync = () => {
            handleTimeUpdate();
            setBuffering(false);
          };
          if (v.readyState >= 2) {
            sync();
          } else {
            setBuffering(true);
            const onSeeked = () => {
              v.removeEventListener("seeked", onSeeked);
              sync();
            };
            v.addEventListener("seeked", onSeeked);
          }
        };

        if (v.readyState >= 1) {
          apply();
        } else {
          pendingSeekMs.current = ms;
          setBuffering(true);
          const onMeta = () => {
            v.removeEventListener("loadedmetadata", onMeta);
            const target = pendingSeekMs.current;
            pendingSeekMs.current = null;
            if (target != null) {
              try {
                v.currentTime = target / 1000;
              } catch {
                /* ignore */
              }
            }
            handleTimeUpdate();
            setBuffering(false);
          };
          v.addEventListener("loadedmetadata", onMeta);
        }
      },
      [handleTimeUpdate],
    );

    useImperativeHandle(
      ref,
      () => ({
        getCurrentTimeMs: () => Math.round((videoRef.current?.currentTime ?? 0) * 1000),
        seekToMs: (ms: number) => applySeek(ms),
        play: async () => {
          await videoRef.current?.play();
          setPlaying(true);
        },
        pause: () => {
          videoRef.current?.pause();
          setPlaying(false);
        },
      }),
      [applySeek],
    );

    useEffect(() => {
      const v = videoRef.current;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      setPlaying(false);
      setCurrentMs(0);
      setDurationMs(0);
      setReady(false);
      setError(null);
      setBuffering(Boolean(src));
      pendingSeekMs.current = null;

      if (!v || !src) {
        setBuffering(false);
        return;
      }

      const useHls = isHlsUrl(src);

      if (useHls) {
        if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = src;
          return () => {
            v.removeAttribute("src");
            v.load();
          };
        }
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startLevel: -1,
          });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setReady(true);
            setBuffering(false);
            if (pendingSeekMs.current != null) {
              const ms = pendingSeekMs.current;
              pendingSeekMs.current = null;
              applySeek(ms);
            }
          });
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              return;
            }
            setError("Could not play this edit. Try re-uploading or wait for encoding.");
            setBuffering(false);
          });
          return () => {
            hls.destroy();
            hlsRef.current = null;
          };
        }
        setError("HLS playback is not supported in this browser.");
        setBuffering(false);
        return;
      }

      v.src = src;
      v.load();
      return () => {
        v.removeAttribute("src");
        v.load();
      };
    }, [src, applySeek]);

    const togglePlay = useCallback(async () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        try {
          await v.play();
          setPlaying(true);
        } catch {
          setError("Playback was blocked. Click play again.");
        }
      } else {
        v.pause();
        setPlaying(false);
      }
    }, []);

    const seekFromProgress = useCallback(
      (clientX: number, rect: DOMRect) => {
        if (!durationMs) return;
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        applySeek(durationMs * ratio);
      },
      [durationMs, applySeek],
    );

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
            className="aspect-video w-full bg-black"
            playsInline
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              handleTimeUpdate();
              setReady(true);
              setBuffering(false);
              if (pendingSeekMs.current != null) {
                const ms = pendingSeekMs.current;
                pendingSeekMs.current = null;
                applySeek(ms);
              }
            }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => {
              setBuffering(false);
              setPlaying(true);
            }}
            onCanPlay={() => {
              setReady(true);
              setBuffering(false);
            }}
            onSeeked={() => {
              handleTimeUpdate();
              setBuffering(false);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              setError("Video failed to load. Check the file or wait for stream encoding.");
              setBuffering(false);
            }}
            onClick={() => void togglePlay()}
          />

          {(buffering || !ready) && !error ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-orange-300" />
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center">
              <p className="text-sm text-slate-300">{error}</p>
            </div>
          ) : null}

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
                if (note.timestampMs == null || !durationMs) return null;
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
                      applySeek(note.timestampMs!);
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
