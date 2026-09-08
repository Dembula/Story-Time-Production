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

type LoaderSize = keyof typeof sizeStyles;

function ServerLoaderOverlay({
  children,
  mode = "viewport",
}: {
  children: React.ReactNode;
  mode?: "viewport" | "inset";
}) {
  return (
    <div
      className={
        mode === "viewport"
          ? "storytime-loader-overlay fixed inset-0 z-[100] flex items-center justify-center"
          : "storytime-loader-overlay storytime-loader-overlay--inset absolute inset-0 z-[20] flex items-center justify-center"
      }
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

/** Server-safe loader — flowing orange bar only (for loading.tsx route segments). */
export function ServerStoryTimeLoader({
  size = "md",
  hideTrack: _hideTrack = false,
}: {
  size?: LoaderSize;
  /** @deprecated Text label removed — bar is always shown. */
  hideTrack?: boolean;
}) {
  const styles = sizeStyles[size];

  return (
    <div
      className="storytime-loader flex flex-col items-center"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className={`storytime-loader__track block ${styles.track}`} aria-hidden />
    </div>
  );
}

export function ServerStoryTimeLoadingScreen({ size = "lg" }: { size?: LoaderSize }) {
  return (
    <ServerLoaderOverlay mode="viewport">
      <ServerStoryTimeLoader size={size} />
    </ServerLoaderOverlay>
  );
}

export function ServerStoryTimeLoadingCenter({
  minHeight: _minHeight,
  size = "md",
}: {
  minHeight?: string;
  size?: LoaderSize;
}) {
  return (
    <ServerLoaderOverlay mode="viewport">
      <ServerStoryTimeLoader size={size} />
    </ServerLoaderOverlay>
  );
}
