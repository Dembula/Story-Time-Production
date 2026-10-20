"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export default function FestivalScreeningPage() {
  const [festivalId, setFestivalId] = useState("");
  const [activeId, setActivePlay] = useState<string | null>(null);

  const { data: list } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });
  const festivals = list?.festivals ?? [];
  const festId = festivalId || festivals[0]?.id || "";

  const { data } = useQuery({
    queryKey: ["festival-screening", festId],
    queryFn: () =>
      fetch(`/api/festival/${festId}/submissions?selection=OFFICIAL_SELECTION`).then((r) => r.json()),
    enabled: Boolean(festId),
  });

  const playlist = useMemo(() => {
    const rows = (data?.submissions ?? []) as Array<{
      id: string;
      title: string;
      screenerUrl?: string | null;
      screeningOrder?: number | null;
    }>;
    return [...rows].sort((a, b) => (a.screeningOrder ?? 999) - (b.screeningOrder ?? 999));
  }, [data?.submissions]);

  const playing = playlist.find((p) => p.id === activeId) || playlist[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Screening</h1>
        <p className="mt-1 text-sm text-slate-400">Play official selections in order for your festival team.</p>
      </div>

      <select
        value={festId}
        onChange={(e) => setFestivalId(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
      >
        {festivals.map((f: { id: string; name: string }) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>

      {playing?.screenerUrl ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
          <video
            key={playing.id}
            src={playing.screenerUrl}
            controls
            autoPlay
            className="aspect-video w-full"
            onEnded={() => {
              const idx = playlist.findIndex((p) => p.id === playing.id);
              const next = playlist[idx + 1];
              if (next) setActivePlay(next.id);
            }}
          />
          <p className="border-t border-slate-800 px-4 py-3 text-sm text-white">{playing.title}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No official selections with screeners yet.</p>
      )}

      <ul className="space-y-1">
        {playlist.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setActivePlay(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                playing?.id === item.id ? "bg-amber-500/15 text-amber-100" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <span className="w-6 text-slate-500">{i + 1}</span>
              <span className="flex-1">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
