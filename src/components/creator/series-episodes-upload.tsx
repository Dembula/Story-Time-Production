"use client";

import { useMemo } from "react";
import { Tv, Film } from "lucide-react";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";

export type EpisodeDraft = {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description: string;
  videoUrl: string;
  duration: string;
};

type Props = {
  seasonCount: number;
  episodesPerSeason: number[];
  episodes: EpisodeDraft[];
  onSeasonCountChange: (n: number) => void;
  onEpisodesPerSeasonChange: (counts: number[]) => void;
  onEpisodesChange: (eps: EpisodeDraft[]) => void;
  onError: (msg: string) => void;
  /** When adding a single season to an existing series */
  mode?: "full" | "singleSeason";
  fixedSeasonNumber?: number;
  /** Prefer global queue upload when provided */
  onUploadEpisode?: (seasonNumber: number, episodeNumber: number, file: File) => void;
  episodeUploadProgress?: (seasonNumber: number, episodeNumber: number) => {
    uploading: boolean;
    progress: number | null;
  };
};

const inputClass =
  "storytime-input w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none";

export function SeriesEpisodesUpload({
  seasonCount,
  episodesPerSeason,
  episodes,
  onSeasonCountChange,
  onEpisodesPerSeasonChange,
  onEpisodesChange,
  onError,
  mode = "full",
  fixedSeasonNumber,
  onUploadEpisode,
  episodeUploadProgress,
}: Props) {
  const singleSeason = mode === "singleSeason";
  const slots = useMemo(() => {
    const list: { seasonNumber: number; episodeNumber: number; key: string }[] = [];
    for (let s = 1; s <= seasonCount; s++) {
      const count = episodesPerSeason[s - 1] ?? 1;
      for (let e = 1; e <= count; e++) {
        list.push({ seasonNumber: s, episodeNumber: e, key: `${s}-${e}` });
      }
    }
    return list;
  }, [seasonCount, episodesPerSeason]);

  function syncEpisodeSlots(nextSeasonCount: number, nextCounts: number[]) {
    onSeasonCountChange(nextSeasonCount);
    onEpisodesPerSeasonChange(nextCounts);
    const nextSlots: EpisodeDraft[] = [];
    for (let s = 1; s <= nextSeasonCount; s++) {
      const count = nextCounts[s - 1] ?? 1;
      for (let e = 1; e <= count; e++) {
        const existing = episodes.find((ep) => ep.seasonNumber === s && ep.episodeNumber === e);
        nextSlots.push(
          existing ?? {
            seasonNumber: s,
            episodeNumber: e,
            title: `Episode ${e}`,
            description: "",
            videoUrl: "",
            duration: "",
          },
        );
      }
    }
    onEpisodesChange(nextSlots);
  }

  function updateEpisode(seasonNumber: number, episodeNumber: number, patch: Partial<EpisodeDraft>) {
    onEpisodesChange(
      episodes.map((ep) =>
        ep.seasonNumber === seasonNumber && ep.episodeNumber === episodeNumber ? { ...ep, ...patch } : ep,
      ),
    );
  }

  async function uploadEpisodeVideo(seasonNumber: number, episodeNumber: number, file: File) {
    if (onUploadEpisode) {
      onUploadEpisode(seasonNumber, episodeNumber, file);
      return;
    }
    try {
      const url = await uploadContentMediaViaApi(file);
      updateEpisode(seasonNumber, episodeNumber, { videoUrl: url });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Episode upload failed");
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border border-orange-400/15 bg-orange-500/[0.04] p-5">
      <div className="flex items-start gap-3">
        <Tv className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
        <div>
          <h3 className="font-semibold text-white">
            {singleSeason && fixedSeasonNumber
              ? `Season ${fixedSeasonNumber} episodes`
              : "Seasons & Episodes"}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {singleSeason
              ? "Upload each episode with a title, blurb, and master file."
              : "Configure your season structure, then upload each episode with a short blurb viewers will see on the title page."}
          </p>
        </div>
      </div>

      {!singleSeason && (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs text-slate-400">Number of seasons</label>
          <select
            value={seasonCount}
            onChange={(e) => {
              const n = Math.max(1, Math.min(10, Number(e.target.value)));
              const counts = Array.from({ length: n }, (_, i) => episodesPerSeason[i] ?? 6);
              syncEpisodeSlots(n, counts);
            }}
            className={inputClass}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} season{n !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: seasonCount }, (_, si) => {
          const s = si + 1;
          return (
            <div key={s} className="rounded-xl border border-white/8 bg-slate-900/40 p-4">
              <label className="mb-2 block text-sm font-medium text-white">Season {s} — episodes</label>
              <select
                value={episodesPerSeason[si] ?? 6}
                onChange={(e) => {
                  const counts = [...episodesPerSeason];
                  counts[si] = Number(e.target.value);
                  syncEpisodeSlots(seasonCount, counts);
                }}
                className={inputClass}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} episode{n !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      </>
      )}

      <div className="space-y-4">
        {slots.map(({ seasonNumber, episodeNumber, key }) => {
          const ep = episodes.find((e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber);
          if (!ep) return null;
          return (
            <div key={key} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-orange-300">
                <Film className="h-4 w-4" />
                S{seasonNumber} · E{episodeNumber}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Episode title</label>
                  <input
                    value={ep.title}
                    onChange={(e) => updateEpisode(seasonNumber, episodeNumber, { title: e.target.value })}
                    className={inputClass}
                    placeholder="Episode title"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Duration (minutes)</label>
                  <input
                    value={ep.duration}
                    onChange={(e) => updateEpisode(seasonNumber, episodeNumber, { duration: e.target.value })}
                    className={inputClass}
                    placeholder="45"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-500">Episode blurb (shown to viewers)</label>
                <textarea
                  value={ep.description}
                  onChange={(e) => updateEpisode(seasonNumber, episodeNumber, { description: e.target.value })}
                  rows={2}
                  className={inputClass}
                  placeholder="What happens in this episode…"
                />
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-500">Episode video *</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadEpisodeVideo(seasonNumber, episodeNumber, file);
                  }}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                />
                {(() => {
                  const progress = episodeUploadProgress?.(seasonNumber, episodeNumber);
                  if (progress?.uploading) {
                    return (
                      <p className="mt-1 text-xs text-orange-300">
                        Uploading…
                        {progress.progress != null ? ` ${Math.round(progress.progress)}%` : ""}
                      </p>
                    );
                  }
                  if (ep.videoUrl) {
                    return <p className="mt-1 text-xs text-green-400">Video uploaded</p>;
                  }
                  return <p className="mt-1 text-xs text-slate-500">Required before submit</p>;
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function buildSeasonsPayload(episodes: EpisodeDraft[]) {
  const seasonMap = new Map<number, EpisodeDraft[]>();
  for (const ep of episodes) {
    const list = seasonMap.get(ep.seasonNumber) ?? [];
    list.push(ep);
    seasonMap.set(ep.seasonNumber, list);
  }
  return Array.from(seasonMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, eps]) => ({
      seasonNumber,
      episodes: eps
        .sort((a, b) => a.episodeNumber - b.episodeNumber)
        .map((e) => ({
          episodeNumber: e.episodeNumber,
          title: e.title.trim() || `Episode ${e.episodeNumber}`,
          description: e.description.trim() || null,
          videoUrl: e.videoUrl,
          duration: e.duration ? parseInt(e.duration, 10) || null : null,
        })),
    }));
}
