"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VideoPlayerProps = {
  src: string | null;
  poster?: string | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnd?: () => void;
};

const PLACEHOLDER_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export function VideoPlayer({
  src,
  poster,
  onTimeUpdate,
  onEnd,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoSrc = src || PLACEHOLDER_VIDEO;

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v && onTimeUpdate) {
      onTimeUpdate(v.currentTime, v.duration);
    }
  }, [onTimeUpdate]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleEnd = () => onEnd?.();
    v.addEventListener("ended", handleEnd);
    return () => v.removeEventListener("ended", handleEnd);
  }, [onEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (v.paused) v.play();
        else v.pause();
        setPlaying(!v.paused);
      }
      if (e.code === "ArrowRight") v.currentTime += 10;
      if (e.code === "ArrowLeft") v.currentTime -= 10;
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        src={videoSrc}
        poster={poster || undefined}
        className="w-full h-full object-contain"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={() => {
          const v = videoRef.current;
          if (v) (v.paused ? v.play() : v.pause());
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const v = videoRef.current;
              if (v) (v.paused ? v.play() : v.pause());
            }}
            className="p-2 rounded-full bg-white/20 hover:bg-white/40"
          >
            {playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => {
              const v = videoRef.current;
              if (v) {
                v.muted = !v.muted;
                setMuted(v.muted);
              }
            }}
            className="p-2 rounded-full bg-white/20 hover:bg-white/40"
          >
            {muted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
