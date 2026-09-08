"use client";

import { cn } from "@/lib/utils";

const sizeStyles = {
  sm: {
    track: "h-0.5 w-16",
  },
  md: {
    track: "h-0.5 w-24 md:w-28",
  },
  lg: {
    track: "h-1 w-36 md:w-44",
  },
} as const;

export type StoryTimeLoaderSize = keyof typeof sizeStyles;

type StoryTimeLoaderProps = {
  size?: StoryTimeLoaderSize;
  className?: string;
  /** @deprecated Text label removed — bar is always shown. Kept for call-site compatibility. */
  hideTrack?: boolean;
};

/** Branded loading indicator — flowing orange bar only (no “Story Time” wordmark). */
export function StoryTimeLoader({ size = "md", className }: StoryTimeLoaderProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={cn("storytime-loader flex flex-col items-center", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className={cn("storytime-loader__track", styles.track)} aria-hidden />
    </div>
  );
}

type OverlayMode = "viewport" | "inset";

/** Frosted glass shell — blurs content beneath instead of solid black. */
export function StoryTimeLoaderOverlay({
  children,
  mode = "viewport",
  className,
}: {
  children: React.ReactNode;
  mode?: OverlayMode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "storytime-loader-overlay relative flex items-center justify-center",
        mode === "viewport" && "fixed inset-0 z-[100]",
        mode === "inset" && "storytime-loader-overlay--inset absolute inset-0 z-[20]",
        className,
      )}
      aria-hidden={mode === "inset" ? true : undefined}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

/** Full-screen frosted overlay for route transitions and heavy buffers. */
export function StoryTimeLoadingScreen({ size = "lg" }: { size?: StoryTimeLoaderSize }) {
  return (
    <StoryTimeLoaderOverlay mode="viewport">
      <StoryTimeLoader size={size} />
    </StoryTimeLoaderOverlay>
  );
}

/** Same frosted viewport overlay for in-page data fetches. */
export function StoryTimeLoadingCenter({
  minHeight: _minHeight,
  size = "md",
  className,
}: {
  minHeight?: string;
  size?: StoryTimeLoaderSize;
  className?: string;
}) {
  return (
    <StoryTimeLoaderOverlay mode="viewport" className={className}>
      <StoryTimeLoader size={size} />
    </StoryTimeLoaderOverlay>
  );
}
