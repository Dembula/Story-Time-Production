"use client";

import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { useContentPrefetch } from "@/hooks/use-content-prefetch";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { isNativeVideoSafeSource, resolveTrailerSources } from "@/lib/playback-sources";
import { getDisplayPosterUrl, getStreamThumbnailGifUrl } from "@/lib/content-media-urls";
import {
  browsePosterCardImageSizes,
  browsePosterCardSkeletonClass,
  browsePosterMediaClass,
  browseRowGapClass,
} from "@/lib/browse-card-layout";
import { BrowsePosterCardShell } from "@/components/layout/browse-poster-card-shell";
import { HorizontalScrollRow } from "@/components/layout/horizontal-scroll-row";

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
  const { deviceClass } = useAdaptiveUi();
  const isMobile = deviceClass === "mobile";
  const trailer = resolveTrailerSources(item.trailerUrl);
  const trailerVideo = isNativeVideoSafeSource(trailer) ? trailer : null;
  // Browse page packs poster/backdrop server-side; prefer those https URLs directly.
  const packedPoster =
    item.posterUrl?.trim() &&
    /^https?:\/\//i.test(item.posterUrl.trim()) &&
    !item.posterUrl.trim().startsWith("s3://")
      ? item.posterUrl.trim()
      : null;
  const packedBackdrop =
    item.backdropUrl?.trim() && /^https?:\/\//i.test(item.backdropUrl.trim())
      ? item.backdropUrl.trim()
      : null;
  const imageUrl = packedPoster ?? getDisplayPosterUrl(item) ?? packedBackdrop;
  const hoverGif =
    !isMobile && !trailerVideo ? getStreamThumbnailGifUrl(item.videoUrl ?? item.trailerUrl) : null;

  const onEnter = useCallback(() => {
    prefetch({
      contentId: item.id,
      videoUrl: item.videoUrl,
      trailerUrl: item.trailerUrl,
      posterUrl: imageUrl,
    });
    setHovering(true);
    const v = videoRef.current;
    if (!v || !trailerVideo) return;
    v.src = trailerVideo.src;
    v.currentTime = 0;
    void v.play().catch(() => {});
  }, [trailerVideo, prefetch, item.id, item.videoUrl, item.trailerUrl, imageUrl]);

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
    <BrowsePosterCardShell>
    <Link
      href={`/browse/content/${item.id}`}
      className="group/card block"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <div className={browsePosterMediaClass} data-browse-poster-media>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.title}
            fill
            sizes={browsePosterCardImageSizes}
            className={`object-cover transition duration-500 ${
              hovering && (trailerVideo || hoverGif) ? "opacity-0" : "opacity-100"
            } md:group-hover/card:scale-[1.04] md:group-hover/card:brightness-110`}
            unoptimized={Boolean(hoverGif && imageUrl?.includes(".gif"))}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">No image</div>
        )}
        {hoverGif && hovering && !trailerVideo ? (
          // eslint-disable-next-line @next/next/no-img-element -- animated Cloudflare GIF preview
          <img
            src={hoverGif}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {trailerVideo && hovering ? (
          <video
            ref={videoRef}
            src={trailerVideo.src}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
            loop
            preload="none"
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/92 via-black/24 to-transparent p-4 opacity-0 transition-all duration-300 md:group-hover/card:opacity-100">
          <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
          {item.category && <p className="mt-1 text-xs text-slate-300">{item.category}</p>}
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-300">
            View details
          </span>
        </div>
        {ppvMode && !/music/i.test(item.type) ? (
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-orange-300/30 bg-orange-500/20 px-2.5 py-1 text-xs text-orange-100 backdrop-blur-sm">
            <Lock className="h-3 w-3" /> Pay to unlock
          </div>
        ) : null}
      </div>
      <p className="mt-2 truncate text-xs font-medium text-white sm:mt-3 sm:text-sm group-hover/card:text-orange-100">{item.title}</p>
      {item.category && <p className="truncate text-[11px] text-slate-400 sm:text-xs">{item.category}</p>}
    </Link>
    </BrowsePosterCardShell>
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
  if (loading) {
    return (
      <div className="mb-12">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className={`flex overflow-hidden ${browseRowGapClass}`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={`${browsePosterCardSkeletonClass} bg-white/[0.06]`} />
          ))}
        </div>
      </div>
    );
  }

  if (!contents?.length) return null;

  return (
    <HorizontalScrollRow
      className="mb-10 sm:mb-14"
      title={<h2 className="font-display text-lg font-semibold text-white sm:text-xl">{title}</h2>}
      subtitle={subtitle}
      scrollClassName={`flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] ${browseRowGapClass}`}
    >
      {contents.map((item) => (
        <ContentCard key={item.id} item={item} ppvMode={ppvMode} />
      ))}
    </HorizontalScrollRow>
  );
}
