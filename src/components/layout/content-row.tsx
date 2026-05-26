"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useContentPrefetch } from "@/hooks/use-content-prefetch";
import { hoverPhysicsProps } from "@/lib/motion/presets";
import { useMotion } from "@/components/motion/motion-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveTrailerSources } from "@/lib/playback-sources";
import { getDisplayPosterUrl, getStreamThumbnailGifUrl } from "@/lib/content-media-urls";

export type ContentItem = {
  id: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  category: string | null;
  type: string;
  trailerUrl?: string | null;
  videoUrl?: string | null;
  _count?: { ratings: number };
};

function ContentCard({
  item,
  ppvMode,
}: {
  item: ContentItem;
  ppvMode: boolean;
}) {
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefetch = useContentPrefetch();
  const { intensity, prefersReducedMotion } = useMotion();
  const trailer = resolveTrailerSources(item.trailerUrl);
  const imageUrl = getDisplayPosterUrl(item);
  const hoverGif = !trailer ? getStreamThumbnailGifUrl(item.videoUrl ?? item.trailerUrl) : null;
  const hoverMotion = prefersReducedMotion ? {} : hoverPhysicsProps(intensity);

  const onEnter = useCallback(() => {
    prefetch({
      contentId: item.id,
      videoUrl: item.videoUrl,
      trailerUrl: item.trailerUrl,
      posterUrl: imageUrl,
    });
    setHovering(true);
    const v = videoRef.current;
    if (!v || !trailer) return;
    v.src = trailer.src;
    v.currentTime = 0;
    void v.play().catch(() => {});
  }, [trailer, prefetch, item.id, item.videoUrl, item.trailerUrl, imageUrl]);

  const onLeave = useCallback(() => {
    setHovering(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute("src");
      v.load();
    }
  }, []);

  return (
    <motion.div className="group/card w-52 shrink-0 snap-start" {...hoverMotion}>
    <Link
      href={`/browse/content/${item.id}`}
      className="block"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-card shadow-media">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 40vw, 208px"
            className={`h-full w-full object-cover transition duration-500 ${
              hovering && (trailer || hoverGif) ? "opacity-0" : "opacity-100"
            } group-hover/card:scale-[1.04] group-hover/card:brightness-110`}
            unoptimized={Boolean(hoverGif && imageUrl?.includes(".gif"))}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">No image</div>
        )}
        {hoverGif && hovering && !trailer ? (
          // eslint-disable-next-line @next/next/no-img-element -- animated Cloudflare GIF preview
          <img
            src={hoverGif}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {trailer && hovering ? (
          <video
            ref={videoRef}
            src={trailer.src}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
            loop
            preload="none"
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/92 via-black/24 to-transparent p-4 opacity-0 transition-all duration-300 group-hover/card:opacity-100">
          <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
          {item.category && <p className="mt-1 text-xs text-slate-300">{item.category}</p>}
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-300">
            View details
          </span>
        </div>
        {item._count?.ratings ? (
          <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-xs text-slate-100 backdrop-blur-sm">
            {item._count.ratings} ratings
          </div>
        ) : null}
        {ppvMode && !/music/i.test(item.type) ? (
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-orange-300/30 bg-orange-500/20 px-2.5 py-1 text-xs text-orange-100 backdrop-blur-sm">
            <Lock className="h-3 w-3" /> Pay to unlock
          </div>
        ) : null}
      </div>
      <p className="mt-3 truncate text-sm font-medium text-white group-hover/card:text-orange-100">{item.title}</p>
      {item.category && <p className="truncate text-xs text-slate-400">{item.category}</p>}
    </Link>
    </motion.div>
  );
}

export function ContentRow({
  title,
  subtitle,
  contents,
  loading,
  ppvMode = false,
}: {
  title: string;
  subtitle?: string;
  contents: ContentItem[];
  loading?: boolean;
  ppvMode?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  if (loading) {
    return (
      <div className="mb-12">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-48 shrink-0 rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  if (!contents?.length) return null;

  return (
    <div className="group/row mb-14">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex gap-2 opacity-0 transition group-hover/row:opacity-100">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 shadow-panel hover:-translate-y-0.5 hover:bg-white/[0.12]"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 shadow-panel hover:-translate-y-0.5 hover:bg-white/[0.12]"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch]"
      >
        {contents.map((item) => (
          <ContentCard key={item.id} item={item} ppvMode={ppvMode} />
        ))}
      </div>
    </div>
  );
}
