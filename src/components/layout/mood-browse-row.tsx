"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

const MOODS = [
  { label: "Slow & emotional", query: "slow emotional drama stories" },
  { label: "Uplifting", query: "uplifting feel good films" },
  { label: "Dark thriller", query: "dark psychological thriller" },
  { label: "Sci-fi", query: "atmospheric science fiction" },
  { label: "Comedy", query: "light comedy shows" },
  { label: "Documentary", query: "thought provoking documentary" },
];

export function MoodBrowseRow() {
  return (
    <div className="mb-14">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-orange-300" />
        <h2 className="font-display text-xl font-semibold text-white">Browse by mood</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <Link
            key={m.label}
            href={`/browse?search=${encodeURIComponent(m.query)}`}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:border-orange-400/30 hover:bg-orange-500/10 hover:text-white"
          >
            {m.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
