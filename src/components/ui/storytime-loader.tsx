"use client";

import { cn } from "@/lib/utils";

const LOADER_TEXT = "Story Time";

const sizeStyles = {
  sm: {
    text: "text-base tracking-[0.12em]",
    track: "mt-1.5 h-0.5 w-16",
    gap: 0.055,
  },
  md: {
    text: "text-2xl tracking-[0.14em] md:text-3xl",
    track: "mt-2 h-0.5 w-24",
    gap: 0.07,
  },
  lg: {
    text: "text-4xl tracking-[0.16em] md:text-5xl",
    track: "mt-3 h-1 w-32",
    gap: 0.08,
  },
} as const;

export type StoryTimeLoaderSize = keyof typeof sizeStyles;

type StoryTimeLoaderProps = {
  size?: StoryTimeLoaderSize;
  className?: string;
  /** Hide the flowing underline (useful in tight inline spots). */
  hideTrack?: boolean;
};

export function StoryTimeLoader({ size = "md", className, hideTrack = false }: StoryTimeLoaderProps) {
  const styles = sizeStyles[size];
  const letters = LOADER_TEXT.split("");

  return (
    <div
      className={cn("storytime-loader flex flex-col items-center", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading Story Time"
    >
      <span
        className={cn(
          "inline-flex items-baseline font-display font-semibold uppercase",
          styles.text,
        )}
      >
        {letters.map((char, index) => (
          <span
            key={`${char}-${index}`}
            className="storytime-loader__letter"
            style={{ animationDelay: `${index * styles.gap}s` }}
            aria-hidden={char === " "}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </span>
      {!hideTrack && <span className={cn("storytime-loader__track", styles.track)} aria-hidden />}
    </div>
  );
}

type StoryTimeLoadingCenterProps = {
  minHeight?: string;
  size?: StoryTimeLoaderSize;
  className?: string;
};

/** Centered loader for page sections and data-fetch buffers. */
export function StoryTimeLoadingCenter({
  minHeight = "60vh",
  size = "md",
  className,
}: StoryTimeLoadingCenterProps) {
  return (
    <div
      className={cn("flex w-full items-center justify-center px-4", className)}
      style={{ minHeight }}
    >
      <StoryTimeLoader size={size} />
    </div>
  );
}

/** Full-screen overlay for route transitions and heavy buffers. */
export function StoryTimeLoadingScreen({ size = "lg" }: { size?: StoryTimeLoaderSize }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-[2px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,153,49,0.12),transparent_55%)]" />
      <StoryTimeLoader size={size} />
    </div>
  );
}
