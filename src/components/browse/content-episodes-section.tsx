"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { usePlaybackPrefetch } from "@/hooks/use-playback-prefetch";

export type EpisodeItem = {
  id: string;
  episodeNumber: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
};

export type SeasonItem = {
  id: string;
  seasonNumber: number;
  title: string | null;
  episodes: EpisodeItem[];
};

type Props = {
  contentId: string;
  seasons: SeasonItem[];
  canPlay: boolean;
  onLockedPlay?: () => void;
};

function formatEpDuration(minutes: number | null) {
  if (!minutes) return null;
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes}m`;
}

export function ContentEpisodesSection({ contentId, seasons, canPlay, onLockedPlay }: Props) {
  const [activeSeasonIdx, setActiveSeasonIdx] = useState(0);
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
  const preparePlayback = usePlaybackPrefetch();
  const { deviceClass, inputMode } = useAdaptiveUi();
  const isMobile = deviceClass === "mobile";
  const isTv = deviceClass === "tv";
  const isRemote = inputMode === "remote";
  const focusRing = isRemote ? "adaptive-interactive focus-visible:outline-none" : "";

  if (!seasons.length) return null;

  const activeSeason = seasons[activeSeasonIdx] ?? seasons[0];
  const seasonLabel = activeSeason.title ?? `Season ${activeSeason.seasonNumber}`;

  const cardWidth = isTv
    ? "w-[min(420px,38vw)]"
    : isMobile
      ? "w-[min(260px,78vw)]"
      : "w-[min(320px,42vw)] sm:w-[340px] lg:w-[360px]";

  function warmEpisode(episode: EpisodeItem) {
    if (!episode.videoUrl) return;
    preparePlayback({
      contentId,
      watchHref: `/browse/content/${contentId}/watch?episode=${episode.id}`,
      videoUrl: episode.videoUrl,
      episodeId: episode.id,
    });
  }

  function handleEpisodeClick(episode: EpisodeItem) {
    if (!episode.videoUrl) return;
    if (!canPlay) {
      onLockedPlay?.();
    }
  }

  return (
    <section className={`${isTv ? "mt-12" : "mt-8 sm:mt-10"}`}>
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => setSeasonPickerOpen((v) => !v)}
            className={`flex max-w-full items-center gap-2 truncate font-display font-semibold text-white ${focusRing} ${
              isTv ? "text-2xl md:text-3xl" : "text-lg sm:text-xl"
            }`}
          >
            <span className="truncate">{seasonLabel}</span>
            {seasons.length > 1 && (
              <ChevronDown
                className={`h-5 w-5 shrink-0 transition ${seasonPickerOpen ? "rotate-180" : ""} ${
                  isTv ? "h-6 w-6" : ""
                }`}
              />
            )}
          </button>
          <AnimatePresence>
            {seasonPickerOpen && seasons.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-20 mt-2 min-w-[200px] max-w-[min(100vw-2rem,280px)] overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur-xl"
              >
                {seasons.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setActiveSeasonIdx(idx);
                      setSeasonPickerOpen(false);
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-white/5 ${focusRing} ${
                      idx === activeSeasonIdx ? "text-orange-200" : "text-slate-300"
                    } ${isTv ? "py-3.5 text-base" : ""}`}
                  >
                    {s.title ?? `Season ${s.seasonNumber}`}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span className={`shrink-0 text-slate-500 ${isTv ? "text-sm" : "text-xs"}`}>
          {activeSeason.episodes.length} episodes
        </span>
      </div>

      <div
        className={`-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide sm:gap-4 ${
          isMobile ? "px-1" : ""
        }`}
      >
        {activeSeason.episodes.map((ep) => {
          const watchHref = `/browse/content/${contentId}/watch?episode=${ep.id}`;
          const thumb = ep.thumbnailUrl;
          const inner = (
            <>
              <div
                className={`relative aspect-video shrink-0 overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-media ${cardWidth}`}
              >
                {thumb ? (
                  <Image src={thumb} alt="" fill sizes="(max-width:640px) 78vw, 360px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                    <Play className={`text-slate-600 ${isTv ? "h-12 w-12" : "h-8 w-8 sm:h-10 sm:w-10"}`} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3">
                  <p
                    className={`font-semibold uppercase tracking-wider text-orange-200/90 ${
                      isTv ? "text-xs" : "text-[10px]"
                    }`}
                  >
                    Episode {ep.episodeNumber}
                  </p>
                  <p className={`truncate font-semibold text-white ${isTv ? "text-base" : "text-sm"}`}>
                    {ep.title}
                  </p>
                  {formatEpDuration(ep.duration) && (
                    <p className={`text-slate-400 ${isTv ? "text-sm" : "text-xs"}`}>
                      {formatEpDuration(ep.duration)}
                    </p>
                  )}
                </div>
                {canPlay && ep.videoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <span
                      className={`flex items-center justify-center rounded-full bg-white/90 shadow-lg ${
                        isTv ? "h-14 w-14" : "h-10 w-10 sm:h-12 sm:w-12"
                      }`}
                    >
                      <Play
                        className={`fill-slate-900 text-slate-900 ${isTv ? "h-6 w-6" : "h-4 w-4 sm:h-5 sm:w-5"}`}
                      />
                    </span>
                  </div>
                )}
              </div>
              {ep.description && (
                <p
                  className={`mt-2 line-clamp-2 leading-relaxed text-slate-400 ${cardWidth} ${
                    isTv ? "text-sm" : "text-xs"
                  }`}
                >
                  {ep.description}
                </p>
              )}
            </>
          );

          if (canPlay && ep.videoUrl) {
            return (
              <Link
                key={ep.id}
                href={watchHref}
                className={`group shrink-0 snap-start ${focusRing}`}
                onPointerEnter={() => warmEpisode(ep)}
                onFocus={() => warmEpisode(ep)}
              >
                {inner}
              </Link>
            );
          }

          return (
            <button
              key={ep.id}
              type="button"
              onClick={() => handleEpisodeClick(ep)}
              className={`group shrink-0 snap-start text-left ${focusRing}`}
              disabled={!ep.videoUrl}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}
