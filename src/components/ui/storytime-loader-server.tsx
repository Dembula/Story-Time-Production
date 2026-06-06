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

type LoaderSize = keyof typeof sizeStyles;

/** Server-safe loader — no client JS required (for loading.tsx route segments). */
export function ServerStoryTimeLoader({
  size = "md",
  hideTrack = false,
}: {
  size?: LoaderSize;
  hideTrack?: boolean;
}) {
  const styles = sizeStyles[size];
  const letters = LOADER_TEXT.split("");

  return (
    <div
      className="storytime-loader flex flex-col items-center"
      role="status"
      aria-live="polite"
      aria-label="Loading Story Time"
    >
      <span
        className={`inline-flex items-baseline font-display font-semibold uppercase ${styles.text}`}
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
      {!hideTrack && <span className={`storytime-loader__track block ${styles.track}`} aria-hidden />}
    </div>
  );
}

export function ServerStoryTimeLoadingScreen({ size = "lg" }: { size?: LoaderSize }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-[2px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,153,49,0.12),transparent_55%)]" />
      <ServerStoryTimeLoader size={size} />
    </div>
  );
}

export function ServerStoryTimeLoadingCenter({
  minHeight = "60vh",
  size = "md",
}: {
  minHeight?: string;
  size?: LoaderSize;
}) {
  return (
    <div className="flex w-full items-center justify-center px-4" style={{ minHeight }}>
      <ServerStoryTimeLoader size={size} />
    </div>
  );
}
