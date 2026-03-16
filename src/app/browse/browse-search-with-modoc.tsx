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
          className="flex-1 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
        />
        {type && <input type="hidden" name="type" value={type} />}
        {filter && <input type="hidden" name="filter" value={filter} />}
        <button
          type="submit"
          className="px-5 py-3 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
        >
          Search
        </button>
      </form>

      {modoc && (
        <div className="relative flex items-center justify-center group">
          <button
            type="button"
            onClick={() => setModocOpen(true)}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/90 to-orange-500/90 flex items-center justify-center shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/10"
            aria-label="Ask MODOC"
          >
            <Bot className="w-6 h-6 text-white" />
          </button>
          <span className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-slate-800/95 text-sm font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-slate-700/80 shadow-xl z-10">
            Ask MODOC
          </span>
        </div>
      )}

      {modoc && (
        <ModocViewerPanel open={modocOpen} onClose={() => setModocOpen(false)} />
      )}
    </div>
  );
}
