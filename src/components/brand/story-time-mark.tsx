import Image from "next/image";
import Link from "next/link";

const MARK_SRC = "/st-mark.png";
const MARK_ASPECT = 963 / 451;

type StoryTimeMarkProps = {
  /** Visual height in pixels (width scales from the wide mark). Ignored when `fullWidth` is set. */
  size?: number;
  /**
   * Stretch the mark to the full width of its parent (mobile hero).
   * Prefer this over bumping `size` when the mark should read edge-to-edge.
   */
  fullWidth?: boolean;
  className?: string;
  priority?: boolean;
};

/**
 * Transparent S.T brand mark — use alone in headers (no “STORY TIME” wordmark).
 */
export function StoryTimeMark({
  size = 36,
  fullWidth = false,
  className = "",
  priority = false,
}: StoryTimeMarkProps) {
  if (fullWidth) {
    return (
      <Image
        src={MARK_SRC}
        alt="Story Time"
        width={963}
        height={451}
        priority={priority}
        sizes="100vw"
        className={`h-auto w-full max-w-none object-contain ${className}`.trim()}
      />
    );
  }

  const width = Math.round(size * MARK_ASPECT);
  return (
    <Image
      src={MARK_SRC}
      alt="Story Time"
      width={width}
      height={size}
      priority={priority}
      className={`object-contain ${className}`.trim()}
      style={{ height: size, width: "auto", maxWidth: width }}
    />
  );
}

type StoryTimeBrandLinkProps = {
  href: string;
  size?: number;
  /** Optional short product label shown beside the mark (e.g. Admin). */
  label?: string;
  className?: string;
  priority?: boolean;
};

export function StoryTimeBrandLink({
  href,
  size = 36,
  label,
  className = "",
  priority = false,
}: StoryTimeBrandLinkProps) {
  return (
    <Link href={href} className={`inline-flex min-w-0 items-center gap-2.5 ${className}`.trim()}>
      <StoryTimeMark size={size} priority={priority} />
      {label ? (
        <span className="truncate text-sm font-medium tracking-wide text-slate-300 sm:text-base">
          {label}
        </span>
      ) : null}
    </Link>
  );
}
