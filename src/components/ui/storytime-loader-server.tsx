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
