"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export type DailiesPlaybackHandle = {
  getCurrentTimeMs: () => number;
  seekToMs: (ms: number) => void;
  play: () => Promise<void>;
  pause: () => void;
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export const DailiesVideoPlayer = forwardRef<
  DailiesPlaybackHandle,
  {
    src: string | null;
    poster?: string;
    loop?: boolean;
    onTimeUpdate?: (ms: number) => void;
    className?: string;
  }
>(function DailiesVideoPlayer({ src, poster, loop = false, onTimeUpdate, className }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(loop);

  useImperativeHandle(ref, () => ({
    getCurrentTimeMs: () => Math.round((videoRef.current?.currentTime ?? 0) * 1000),
    seekToMs: (ms: number) => {
      if (videoRef.current) videoRef.current.currentTime = ms / 1000;
    },
    play: async () => {
      await videoRef.current?.play();
    },
    pause: () => videoRef.current?.pause(),
  }));

  if (!src) {
    return (
      <div className={`flex aspect-video items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 ${className ?? ""}`}>
        <p className="text-sm text-slate-500">No video source — upload footage to begin review</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls
          loop={loopEnabled}
          playsInline
          className="aspect-video w-full"
          onTimeUpdate={() => onTimeUpdate?.(Math.round((videoRef.current?.currentTime ?? 0) * 1000))}
        />
        <div className="absolute bottom-12 right-2 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-orange-200">
          {formatTimecode((videoRef.current?.currentTime ?? 0) * 1000)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="text-slate-500">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSpeed(s);
              if (videoRef.current) videoRef.current.playbackRate = s;
            }}
            className={`rounded px-2 py-0.5 ${speed === s ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400"}`}
          >
            {s}×
          </button>
        ))}
        <button
          type="button"
          onClick={() => setLoopEnabled((v) => !v)}
          className={`rounded px-2 py-0.5 ${loopEnabled ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400"}`}
        >
          Loop {loopEnabled ? "on" : "off"}
        </button>
        <button
          type="button"
          className="rounded bg-slate-800 px-2 py-0.5 text-slate-400 hover:text-white"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.currentTime = Math.max(0, v.currentTime - 1 / 24);
          }}
        >
          −1 frame
        </button>
        <button
          type="button"
          className="rounded bg-slate-800 px-2 py-0.5 text-slate-400 hover:text-white"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.currentTime = v.currentTime + 1 / 24;
          }}
        >
          +1 frame
        </button>
      </div>
    </div>
  );
});

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const frames = Math.floor((ms % 1000) / (1000 / 24));
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  return `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}
