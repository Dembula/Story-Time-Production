import type { ReactNode } from "react";
import { browsePosterCardClass } from "@/lib/browse-card-layout";

/** Fixed-width flex item for browse rows — use instead of motion.div on the card shell. */
export function BrowsePosterCardShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-browse-poster-card className={`${browsePosterCardClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
