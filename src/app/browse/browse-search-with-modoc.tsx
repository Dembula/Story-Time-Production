"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { ModocViewerPanel } from "@/components/modoc";
import { useModocOptional } from "@/components/modoc/use-modoc";

type Props = {
  defaultSearch?: string;
  type?: string;
  filter?: string;
};

export function BrowseSearchWithModoc({ defaultSearch = "", type, filter }: Props) {
  const [modocOpen, setModocOpen] = useState(false);
  const modoc = useModocOptional();

  return (
    <div className="mb-6 flex items-center gap-3">
      <form action="/browse" method="get" className="flex flex-1 max-w-xl gap-2">
        <input
          type="search"
          name="search"
          defaultValue={defaultSearch}
          placeholder="Search films, shows, genres, titles..."
          className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white shadow-panel placeholder:text-slate-500 focus:border-orange-400/40 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
        {type && <input type="hidden" name="type" value={type} />}
        {filter && <input type="hidden" name="filter" value={filter} />}
        <button
          type="submit"
          className="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400"
        >
          Search
        </button>
      </form>

      {modoc && (
        <div className="relative flex items-center justify-center group">
          <button
            type="button"
            onClick={() => setModocOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-cyan-500/90 to-orange-500/90 shadow-glow hover:scale-105 active:scale-95"
            aria-label="Ask AI"
          >
            <Bot className="w-6 h-6 text-white" />
          </button>
          <span className="pointer-events-none absolute left-full z-10 ml-3 whitespace-nowrap rounded-xl border border-white/10 bg-[#0a0f18]/95 px-3 py-1.5 text-sm font-medium text-white opacity-0 shadow-panel transition-opacity duration-200 group-hover:opacity-100">
            Ask AI
          </span>
        </div>
      )}

      {modoc && (
        <ModocViewerPanel open={modocOpen} onClose={() => setModocOpen(false)} />
      )}
    </div>
  );
}
