"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Film, Music, Sparkles } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";

type SelectionRow = {
  id: string;
  usage: string | null;
  notes: string | null;
  createdAt: string;
  track: { id: string; title: string; coverUrl: string | null };
  project: { id: string; title: string; status: string; phase: string; type: string; genre: string | null };
};

type DealRow = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  musicTrack: { id: string; title: string };
  content: { id: string; title: string; type: string };
};

type MembershipRow = {
  id: string;
  role: string;
  project: { id: string; title: string; status: string; phase: string; type: string };
};

export default function MusicScoringPage() {
  const [selections, setSelections] = useState<SelectionRow[]>([]);
  const [syncDeals, setSyncDeals] = useState<DealRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/music-creator/scoring")
      .then((r) => r.json())
      .then((data) => {
        setSelections(data.selections ?? []);
        setSyncDeals(data.syncDeals ?? []);
        setMemberships(data.memberships ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <Link href="/music-creator/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-pink-500" /> Scoring & placements
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Project scoring selections, paid sync placements, and your Originals music team roles.
        </p>
      </div>

      {memberships.length > 0 && (
        <section className="storytime-plan-card p-6 space-y-3">
          <h2 className="text-lg font-medium text-white">Originals music team</h2>
          {memberships.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex justify-between gap-4">
              <div>
                <p className="text-white font-medium">{m.project.title}</p>
                <p className="text-xs text-pink-400 mt-1">
                  {m.role} · {m.project.type} · {m.project.phase.replace(/_/g, " ")}
                </p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">{m.project.status.replace(/_/g, " ")}</span>
            </div>
          ))}
        </section>
      )}

      <section className="storytime-plan-card p-6 space-y-3">
        <h2 className="text-lg font-medium text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-violet-400" /> Project scoring selections
        </h2>
        {selections.length === 0 ? (
          <p className="text-sm text-slate-500">No tracks selected on productions yet. Paid sync licenses and creator scoring picks appear here.</p>
        ) : (
          selections.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex gap-4">
              {s.track.coverUrl ? (
                <img src={s.track.coverUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <Music className="w-6 h-6 text-slate-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-medium">{s.track.title}</p>
                <p className="text-sm text-violet-300">{s.project.title}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {s.usage ?? "Scoring"} · {s.project.genre ?? s.project.type} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
                {s.notes && <p className="text-xs text-slate-400 mt-1">{s.notes}</p>}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="storytime-plan-card p-6 space-y-3">
        <h2 className="text-lg font-medium text-white">Paid sync placements</h2>
        {syncDeals.length === 0 ? (
          <p className="text-sm text-slate-500">Approved and paid sync requests create placements tracked in your revenue hub.</p>
        ) : (
          syncDeals.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex justify-between gap-4">
              <div>
                <p className="text-white font-medium">{d.musicTrack.title}</p>
                <p className="text-sm text-slate-400">{d.content.title} ({d.content.type})</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-emerald-400 font-medium">{formatZar(d.amount)}</p>
                <p className="text-xs text-slate-500">{d.status} · {new Date(d.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
