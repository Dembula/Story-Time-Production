import Image from "next/image";
import Link from "next/link";

const MARK_SRC = "/st-mark.png";

type StoryTimeMarkProps = {
  /** Visual height in pixels (width scales from the wide mark). */
  size?: number;
  className?: string;
  priority?: boolean;
};

/**
 * Transparent S.T brand mark — use alone in headers (no “STORY TIME” wordmark).
 */
export function StoryTimeMark({ size = 36, className = "", priority = false }: StoryTimeMarkProps) {
  const width = Math.round(size * 2.15);
  return (
    <Image
      src={MARK_SRC}
      alt="Story Time"
      width={width}
      height={size}
      priority={priority}
      className={`mx-auto block object-contain ${className}`.trim()}
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
