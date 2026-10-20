"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Film, Play } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalEmptyPanel } from "@/components/festival/festival-empty-panel";
import { FestivalScopeSelect } from "@/components/festival/festival-scope-select";
import { useActiveFestival } from "@/components/festival/use-active-festival";

export default function FestivalScreeningPage() {
  const { festivals, activeId, setActiveFestivalId, isLoading: listLoading } = useActiveFestival();
  const [activePlay, setActivePlay] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["festival-screening", activeId],
    queryFn: () =>
      fetch(`/api/festival/${activeId}/submissions?selection=OFFICIAL_SELECTION`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const playlist = useMemo(() => {
    const rows = (data?.submissions ?? []) as Array<{
      id: string;
      title: string;
      screenerUrl?: string | null;
      screeningOrder?: number | null;
      creator?: { name?: string | null };
    }>;
    return [...rows].sort((a, b) => (a.screeningOrder ?? 999) - (b.screeningOrder ?? 999));
  }, [data?.submissions]);

  const withScreener = playlist.filter((p) => p.screenerUrl);
  const playing = playlist.find((p) => p.id === activePlay) || withScreener[0] || null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <OpsPageHeader title="Screening" subtitle="Official selections for your festival team." />

      <FestivalScopeSelect
        festivals={festivals}
        value={activeId}
        onChange={setActiveFestivalId}
        isLoading={listLoading}
      />

      {!activeId ? (
        <FestivalEmptyPanel
          icon={Film}
          title="Select a festival"
          actionHref="/festival/festivals"
          actionLabel="My festivals"
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <OpsMetricCard label="Official selection" value={playlist.length} accent="orange" />
            <OpsMetricCard label="With screener" value={withScreener.length} accent="emerald" />
            <OpsMetricCard
              label="Now playing"
              value={playing ? "1" : "0"}
              sub={playing?.title}
              accent="cyan"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <OpsSection title="Player">
              {isLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : playing?.screenerUrl ? (
                <div className="overflow-hidden rounded-2xl border border-white/8 bg-black shadow-panel">
                  <video
                    key={playing.id}
                    src={playing.screenerUrl}
                    controls
                    className="aspect-video w-full bg-black"
                    onEnded={() => {
                      const idx = withScreener.findIndex((p) => p.id === playing.id);
                      const next = withScreener[idx + 1];
                      if (next) setActivePlay(next.id);
                    }}
                  />
                  <div className="border-t border-white/8 px-4 py-3">
                    <p className="font-medium text-white">{playing.title}</p>
                    <p className="text-xs text-slate-500">{playing.creator?.name || "Filmmaker"}</p>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-slate-950 via-slate-900 to-black">
                  <div className="aspect-video flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-500/25 bg-orange-500/10">
                      <Play className="h-7 w-7 text-orange-300" />
                    </div>
                    <p className="font-display text-lg font-semibold text-white">Screening room ready</p>
                    <p className="max-w-sm text-sm text-slate-400">
                      Official selections with screener links will play here. Promote entries in Review hub first.
                    </p>
                  </div>
                </div>
              )}
            </OpsSection>

            <OpsSection title="Playlist">
              {playlist.length === 0 ? (
                <FestivalEmptyPanel
                  icon={Film}
                  title="No official selections yet"
                  body="Mark films as official selection in Stage 2 review."
                  actionHref="/festival/review"
                  actionLabel="Open review hub"
                />
              ) : (
                <ul className="space-y-1 rounded-2xl border border-white/8 p-2">
                  {playlist.map((item, i) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => item.screenerUrl && setActivePlay(item.id)}
                        disabled={!item.screenerUrl}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          playing?.id === item.id
                            ? "bg-orange-500/15 text-orange-100"
                            : "text-slate-300 hover:bg-white/5 disabled:opacity-40"
                        }`}
                      >
                        <span className="w-6 text-slate-500">{i + 1}</span>
                        <span className="flex-1 truncate">{item.title}</span>
                        {!item.screenerUrl ? (
                          <span className="text-[10px] uppercase text-slate-600">No file</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </OpsSection>
          </div>
        </>
      )}
    </div>
  );
}
