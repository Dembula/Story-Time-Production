"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, Video } from "lucide-react";
import { SecureImage } from "@/components/files/secure-image";
import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";
import { cn } from "@/lib/utils";

type TreatmentVideoStillProps = {
  url: string;
  thumbnailUrl?: string | null;
  projectId?: string;
  className?: string;
  alt?: string;
  /** When true, video can play (editor preview or presentation). */
  allowPlayback?: boolean;
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  showPlayHint?: boolean;
};

/**
 * Clip on the slide: still frame with a Keynote-style play control.
 * Plays only when allowPlayback + playing (user gesture).
 */
export function TreatmentVideoStill({
  url,
  thumbnailUrl,
  projectId,
  className,
  alt = "Clip",
  allowPlayback = false,
  playing = false,
  onPlayingChange,
  showPlayHint = false,
}: TreatmentVideoStillProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resolved = resolveRenderableFileSource(url, { projectId });
  const poster = thumbnailUrl
    ? resolveRenderableFileSource(thumbnailUrl, { projectId })
    : null;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !allowPlayback) return;
    if (playing) {
      el.muted = false;
      void el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => onPlayingChange?.(false));
      });
    } else {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [playing, allowPlayback, onPlayingChange]);

  const togglePlay = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!allowPlayback) return;
    onPlayingChange?.(!playing);
  };

  // Prefer static poster when not allowed to play.
  if (!allowPlayback && poster) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        <SecureImage
          fileRef={thumbnailUrl || url}
          alt={alt}
          className="pointer-events-none h-full w-full object-cover"
          projectId={projectId}
        />
        {showPlayHint ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
              <Play className="h-5 w-5 fill-current pl-0.5" />
            </span>
          </span>
        ) : (
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
            Clip
          </span>
        )}
      </div>
    );
  }

  if (!resolved) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-slate-800 text-slate-500",
          className,
        )}
      >
        <Video className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <video
        ref={videoRef}
        src={allowPlayback ? resolved : `${resolved}#t=0.001`}
        poster={poster ?? undefined}
        className="pointer-events-none h-full w-full object-cover"
        muted={!allowPlayback || !playing}
        playsInline
        preload="metadata"
        controls={false}
        onPlay={(e) => {
          if (!allowPlayback) {
            e.currentTarget.pause();
          }
        }}
        onEnded={() => onPlayingChange?.(false)}
      />

      {allowPlayback ? (
        <button
          type="button"
          aria-label={playing ? "Pause clip" : "Play clip"}
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center transition",
            playing ? "bg-transparent hover:bg-black/20" : "bg-black/25",
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={togglePlay}
        >
          {playing ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-lg backdrop-blur-sm transition hover:opacity-100 focus-visible:opacity-100 [.absolute:hover>&]:opacity-100">
              <Pause className="h-4 w-4 fill-current" />
            </span>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-xl backdrop-blur-sm ring-1 ring-white/20">
              <Play className="h-5 w-5 fill-current pl-0.5" />
            </span>
          )}
        </button>
      ) : showPlayHint ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-lg">
            <Play className="h-4 w-4 fill-current pl-0.5" />
          </span>
        </span>
      ) : (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
          Clip
        </span>
      )}
    </div>
  );
}
