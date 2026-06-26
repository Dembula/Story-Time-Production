"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMotion } from "@/components/motion/motion-provider";

type HorizontalScrollRowProps = {
  id?: string;
  title?: ReactNode;
  subtitle?: string;
  headerEnd?: ReactNode;
  className?: string;
  scrollClassName?: string;
  children: ReactNode;
  /** Side overlay arrows on md+ (default true). Mobile is always touch-scroll. */
  sideArrows?: boolean;
};

export function HorizontalScrollRow({
  id,
  title,
  subtitle,
  headerEnd,
  className = "",
  scrollClassName = "",
  children,
  sideArrows = true,
}: HorizontalScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { prefersReducedMotion } = useMotion();

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.82;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  const arrowWrapClass =
    "pointer-events-none absolute top-1/2 z-10 hidden -translate-y-1/2 md:flex md:opacity-0 md:transition md:duration-300 md:group-hover/scroll-row:opacity-100 md:group-focus-within/scroll-row:opacity-100";

  return (
    <div id={id} className={`group/scroll-row ${className}`.trim()}>
      {(title || subtitle || headerEnd) && (
        <div className="mb-3 flex items-end justify-between sm:mb-5">
          <div>
            {title}
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-400 sm:mt-1 sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
          {headerEnd}
        </div>
      )}

      <div className="relative">
        {sideArrows ? (
          <>
            <div className={`${arrowWrapClass} left-0 pl-1`}>
              <motion.button
                type="button"
                onClick={() => scroll("left")}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                className="pointer-events-auto rounded-full border border-white/12 bg-black/70 p-2.5 shadow-panel backdrop-blur-xl transition hover:bg-black/85"
                aria-label="Scroll left"
                tabIndex={-1}
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </motion.button>
            </div>
            <div className={`${arrowWrapClass} right-0 pr-1`}>
              <motion.button
                type="button"
                onClick={() => scroll("right")}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                className="pointer-events-auto rounded-full border border-white/12 bg-black/70 p-2.5 shadow-panel backdrop-blur-xl transition hover:bg-black/85"
                aria-label="Scroll right"
                tabIndex={-1}
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </motion.button>
            </div>
          </>
        ) : null}

        <div ref={scrollRef} data-spatial-nav="row" className={scrollClassName}>
          {children}
        </div>
      </div>
    </div>
  );
}
