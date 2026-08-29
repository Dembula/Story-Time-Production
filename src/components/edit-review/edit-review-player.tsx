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
  mimeType?: string | null;
  posterUrl?: string | null;
  statusMessage?: string | null;
  notes: EditReviewNote[];
  onTimeUpdate?: (ms: number, durationMs: number) => void;
  onNoteMarkerClick?: (note: EditReviewNote) => void;
  className?: string;
};

function isHlsSource(src: string, mimeType?: string | null) {
  if (mimeType?.includes("mpegurl")) return true;
  return (
    /\.m3u8(\?|$)/i.test(src) ||
    src.includes("videodelivery.net") ||
    src.includes("cloudflarestream.com")
  );
}

export const EditReviewPlayer = forwardRef<EditReviewPlaybackHandle, EditReviewPlayerProps>(
  function EditReviewPlayer(
    {
      src,
      mimeType,
      posterUrl,
      statusMessage,
      notes,
      onTimeUpdate,
      onNoteMarkerClick,
      className,
    },
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
    const [hasFrame, setHasFrame] = useState(false);
    const [buffering, setBuffering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const publishTime = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      const ms = Math.round(v.currentTime * 1000);
      const dur = Math.round((Number.isFinite(v.duration) ? v.duration : 0) * 1000);
      setCurrentMs(ms);
      if (dur > 0) setDurationMs(dur);
      onTimeUpdate?.(ms, dur);
    }, [onTimeUpdate]);

    const checkDecodedFrame = useCallback(() => {
      const v = videoRef.current;
      if (!v) return false;
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        setHasFrame(true);
        return true;
      }
      return false;
    }, []);

    const applySeek = useCallback(
      (ms: number) => {
        const v = videoRef.current;
        if (!v) {
          pendingSeekMs.current = ms;
          return;
        }
        const seconds = Math.max(0, ms / 1000);
        pendingSeekMs.current = null;
        setBuffering(true);

        const finish = () => {
          publishTime();
          setBuffering(false);
          checkDecodedFrame();
          if (v.paused && v.videoWidth > 0) {
            const wasMuted = v.muted;
            v.muted = true;
            void v
              .play()
              .then(() => {
                requestAnimationFrame(() => {
                  v.pause();
                  v.muted = wasMuted;
                  setPlaying(false);
                  publishTime();
                });
              })
              .catch(() => {
                v.muted = wasMuted;
              });
          }
        };

        const run = () => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            v.removeEventListener("seeked", done);
            finish();
          };
          v.addEventListener("seeked", done);
          try {
            v.currentTime = seconds;
          } catch {
            pendingSeekMs.current = ms;
            v.removeEventListener("seeked", done);
            setBuffering(false);
            return;
          }
          window.setTimeout(done, 2000);
        };

        if (v.readyState >= 1) run();
        else {
          pendingSeekMs.current = ms;
          const onMeta = () => {
            v.removeEventListener("loadedmetadata", onMeta);
            const target = pendingSeekMs.current;
            pendingSeekMs.current = null;
            if (target != null) applySeek(target);
          };
          v.addEventListener("loadedmetadata", onMeta);
        }
      },
      [publishTime, checkDecodedFrame],
    );

    useImperativeHandle(
      ref,
      () => ({
        getCurrentTimeMs: () => Math.round((videoRef.current?.currentTime ?? 0) * 1000),
        seekToMs: (ms: number) => applySeek(ms),
        play: async () => {
          const v = videoRef.current;
          if (!v) return;
          await v.play();
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
      setHasFrame(false);
      setError(null);
      setBuffering(Boolean(src));
      pendingSeekMs.current = null;

      if (!v || !src) {
        setBuffering(false);
        return;
      }

      let cancelled = false;
      const useHls = isHlsSource(src, mimeType);

      const stallTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (!v.duration || !Number.isFinite(v.duration) || v.readyState < 1) {
          setError(
            "Video is taking too long to load. Try Retry, or re-upload as an H.264 MP4.",
          );
          setBuffering(false);
        }
      }, 20_000);

      const markReady = () => {
        if (cancelled) return;
        setReady(true);
        setBuffering(false);
        publishTime();
        window.setTimeout(() => {
          if (cancelled) return;
          if (!checkDecodedFrame() && v.readyState >= 2 && v.duration > 0) {
            setError(
              "File loaded but no picture (unsupported codec). Upload an H.264 MP4 for browser review.",
            );
          }
        }, 1500);
        if (pendingSeekMs.current != null) {
          const ms = pendingSeekMs.current;
          pendingSeekMs.current = null;
          applySeek(ms);
        }
      };

      if (useHls) {
        if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = src;
          v.load();
          return () => {
            cancelled = true;
            window.clearTimeout(stallTimer);
            v.removeAttribute("src");
            v.load();
          };
        }
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startLevel: -1,
            maxBufferLength: 45,
            capLevelToPlayerSize: true,
          });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, markReady);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (cancelled || !data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              return;
            }
            setError("Could not play this stream. Re-upload as H.264 MP4.");
            setBuffering(false);
          });
          return () => {
            cancelled = true;
            window.clearTimeout(stallTimer);
            hls.destroy();
            hlsRef.current = null;
          };
        }
        setError("HLS is not supported in this browser.");
        setBuffering(false);
        window.clearTimeout(stallTimer);
        return;
      }

      v.src = src;
      v.load();
      return () => {
        cancelled = true;
        window.clearTimeout(stallTimer);
        v.removeAttribute("src");
        v.load();
      };
    }, [src, mimeType, applySeek, publishTime, checkDecodedFrame]);

    const togglePlay = useCallback(async () => {
      const v = videoRef.current;
      if (!v || !src) return;
      setError(null);
      if (v.paused) {
        try {
          await v.play();
          setPlaying(true);
          setBuffering(false);
          checkDecodedFrame();
        } catch (err) {
          console.error(err);
          setError("Playback blocked or failed. Click play again.");
          setBuffering(false);
        }
      } else {
        v.pause();
        setPlaying(false);
      }
    }, [src, checkDecodedFrame]);

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
            "flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-black/60 px-6 text-center",
            className,
          )}
        >
          {statusMessage ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-orange-300" />
              <p className="max-w-md text-sm text-slate-300">{statusMessage}</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Upload an edit to start review</p>
          )}
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
            className="aspect-video w-full bg-black object-contain"
            playsInline
            preload="auto"
            poster={posterUrl ?? undefined}
            controls={false}
            onTimeUpdate={publishTime}
            onLoadedMetadata={() => {
              publishTime();
              setReady(true);
              setBuffering(false);
              checkDecodedFrame();
              if (pendingSeekMs.current != null) {
                const ms = pendingSeekMs.current;
                pendingSeekMs.current = null;
                applySeek(ms);
              }
            }}
            onLoadedData={() => {
              setReady(true);
              setBuffering(false);
              checkDecodedFrame();
            }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => {
              setBuffering(false);
              setPlaying(true);
              checkDecodedFrame();
              setError(null);
            }}
            onCanPlay={() => {
              setReady(true);
              setBuffering(false);
              checkDecodedFrame();
            }}
            onSeeked={() => {
              publishTime();
              setBuffering(false);
              checkDecodedFrame();
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              console.error("edit review video error", videoRef.current?.error);
              setError(
                "Video failed to load. Prefer an H.264 MP4 upload, or wait for streaming encode.",
              );
              setBuffering(false);
              setReady(false);
            }}
            onClick={() => void togglePlay()}
          />

          {buffering && !error ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
              <Loader2 className="h-8 w-8 animate-spin text-orange-300" />
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
              <p className="max-w-md text-sm text-slate-300">{error}</p>
              <button
                type="button"
                className="rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                onClick={() => {
                  setError(null);
                  setBuffering(true);
                  const v = videoRef.current;
                  if (v && src) v.load();
                }}
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pb-3 pt-12">
            <div
              className="relative mb-2 h-2 cursor-pointer rounded-full bg-white/20"
              role="slider"
              aria-valuemin={0}
              aria-valuemax={durationMs}
              aria-valuenow={currentMs}
              onClick={(e) =>
                seekFromProgress(e.clientX, e.currentTarget.getBoundingClientRect())
              }
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
                    className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 bg-orange-300 shadow hover:scale-125"
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
                onClick={(e) => {
                  e.stopPropagation();
                  void togglePlay();
                }}
                className="rounded p-1.5 hover:bg-white/10"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !v.muted;
                  setMuted(v.muted);
                }}
                className="rounded p-1.5 hover:bg-white/10"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <span className="font-mono text-xs text-slate-300">
                {formatReviewTimecode(currentMs)} / {formatReviewTimecode(durationMs || 0)}
              </span>
              {ready && !hasFrame && durationMs > 0 ? (
                <span className="text-[10px] text-amber-300/90">No video frame</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
