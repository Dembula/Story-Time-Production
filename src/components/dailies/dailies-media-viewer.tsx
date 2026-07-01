"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { ImageIcon } from "lucide-react";
import type { DailiesClipRecord } from "@/lib/dailies/types";
import { isDailiesStillMedia, resolveDailiesMediaType } from "@/lib/dailies/media";
import { resolveDailiesClipPlaybackUrl } from "@/lib/dailies/resolve-playback-url";
import { DailiesVideoPlayer, type DailiesPlaybackHandle } from "@/components/dailies/dailies-video-player";

type DailiesMediaViewerProps = {
  clip: Pick<DailiesClipRecord, "videoUrl" | "proxyUrl" | "mediaType" | "metadata" | "title"> | null;
  src?: string | null;
  onTimeUpdate?: (ms: number) => void;
  className?: string;
};

export const DailiesMediaViewer = forwardRef<DailiesPlaybackHandle, DailiesMediaViewerProps>(
  function DailiesMediaViewer({ clip, src, onTimeUpdate, className }, ref) {
    const videoRef = useRef<DailiesPlaybackHandle>(null);

    const playbackUrl = src ?? resolveDailiesClipPlaybackUrl(clip);
    const mediaType = clip ? resolveDailiesMediaType(clip) : "video";
    const isStill = isDailiesStillMedia(mediaType);

    useImperativeHandle(
      ref,
      () => ({
        getCurrentTimeMs: () => (isStill ? 0 : videoRef.current?.getCurrentTimeMs() ?? 0),
        seekToMs: (ms: number) => {
          if (!isStill) videoRef.current?.seekToMs(ms);
        },
        play: async () => {
          if (!isStill) await videoRef.current?.play();
        },
        pause: () => {
          if (!isStill) videoRef.current?.pause();
        },
      }),
      [isStill],
    );

    if (!playbackUrl) {
      return (
        <div
          className={`flex aspect-video items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 ${className ?? ""}`}
        >
          <p className="text-sm text-slate-500">
            No media — upload a clip or still to begin review
          </p>
        </div>
      );
    }

    if (isStill) {
      return (
        <div className={`space-y-2 ${className ?? ""}`}>
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={playbackUrl}
              alt={clip?.title ?? "Dailies still"}
              className="max-h-[min(70vh,720px)] w-full object-contain bg-slate-950"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] text-slate-200">
              <ImageIcon className="h-3 w-3" />
              Still / photo
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Review this frame for continuity, performance, and composition. Notes apply to the full still.
          </p>
        </div>
      );
    }

    return (
      <DailiesVideoPlayer
        ref={videoRef}
        src={playbackUrl}
        onTimeUpdate={onTimeUpdate}
        className={className}
      />
    );
  },
);
