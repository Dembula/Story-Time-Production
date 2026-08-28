"use client";

type PlaybackSubtitleOverlayProps = {
  text: string | null;
  visible: boolean;
};

/** Cross-platform subtitle overlay (desktop hls.js, Android, LG/Samsung TV browsers, iOS fallback). */
export function PlaybackSubtitleOverlay({ text, visible }: PlaybackSubtitleOverlayProps) {
  if (!visible || !text?.trim()) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-[25] flex justify-center px-4 sm:bottom-[max(6.5rem,env(safe-area-inset-bottom))]"
      aria-live="polite"
    >
      <p className="max-w-[min(92vw,48rem)] rounded-md bg-black/78 px-3 py-2 text-center text-[clamp(0.95rem,2.6vw,1.35rem)] font-medium leading-snug text-white shadow-lg [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
        {text}
      </p>
    </div>
  );
}
