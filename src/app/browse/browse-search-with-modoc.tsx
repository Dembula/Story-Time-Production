"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Film, Loader2 } from "lucide-react";
import { ModocViewerPanel } from "@/components/modoc";
import { useModocOptional } from "@/components/modoc/use-modoc";
import { useMotion } from "@/components/motion/motion-provider";
import { viewerDropdownVariants, viewerSprings } from "@/lib/motion/viewer-presets";

type SearchHit = {
  id: string;
  title: string;
  type: string;
  category: string | null;
  posterUrl: string | null;
  creatorName: string | null;
};

type Props = {
  defaultSearch?: string;
  type?: string;
  filter?: string;
};

const RECENT_SEARCH_KEY = "storytime_recent_searches";
const TRENDING = ["Student films", "Documentary", "Live music", "Sci-fi series"];

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  const trimmed = q.trim();
  if (trimmed.length < 2) return;
  const next = [trimmed, ...loadRecent().filter((x) => x !== trimmed)].slice(0, 6);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
}
const CONTENT_TYPES = [
  { value: "", label: "All types" },
  { value: "MOVIE", label: "Movies" },
  { value: "SERIES", label: "Series" },
  { value: "SHOW", label: "Shows" },
  { value: "PODCAST", label: "Podcasts" },
];

export function BrowseSearchWithModoc({ defaultSearch = "", type, filter }: Props) {
  const router = useRouter();
  const [modocOpen, setModocOpen] = useState(false);
  const [query, setQuery] = useState(defaultSearch);
  const [typeFilter, setTypeFilter] = useState(type ?? "");
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const modoc = useModocOptional();
  const { prefersReducedMotion } = useMotion();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const showRecentDropdown = showDropdown && query.trim().length < 2 && (recentSearches.length > 0 || TRENDING.length > 0);
  const showResultsDropdown = showDropdown && query.trim().length >= 2;

  const fetchSuggestions = useCallback(async (q: string, contentType: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const useSemantic = q.trim().split(/\s+/).length >= 3;
      const endpoint = useSemantic ? "/api/browse/semantic-search" : "/api/browse/search";
      const params = new URLSearchParams({ q: q.trim(), limit: "8" });
      if (!useSemantic && contentType) params.set("type", contentType);
      const res = await fetch(`${endpoint}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.results ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRecentSearches(loadRecent());
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query, typeFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, typeFilter, fetchSuggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function submitSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim()) {
      pushRecent(query.trim());
      setRecentSearches(loadRecent());
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (typeFilter) params.set("type", typeFilter);
    if (filter) params.set("filter", filter);
    const qs = params.toString();
    router.push(qs ? `/browse?${qs}` : "/browse");
    setShowDropdown(false);
  }

  return (
    <div className="mb-6 flex items-center gap-3">
      <div ref={wrapRef} className="relative flex flex-1 max-w-2xl flex-col gap-2 sm:flex-row">
        <form onSubmit={submitSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              name="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Try: slow emotional sci-fi stories…"
              className="viewer-motion-surface viewer-motion-glow w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-white shadow-panel backdrop-blur-xl placeholder:text-slate-500 focus:border-orange-400/40 focus:outline-none focus:ring-2 focus:ring-orange-500/35"
              autoComplete="off"
            />
            <AnimatePresence>
            {showRecentDropdown && (
              <motion.div
                key="recent-dropdown"
                className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/92 shadow-2xl backdrop-blur-2xl"
                variants={viewerDropdownVariants()}
                initial={prefersReducedMotion ? false : "hidden"}
                animate="visible"
                exit="exit"
              >
                {recentSearches.length > 0 && (
                  <div className="border-b border-white/8 px-4 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent</p>
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setQuery(term);
                          router.push(`/browse?search=${encodeURIComponent(term)}`);
                          setShowDropdown(false);
                        }}
                        className="block w-full truncate py-1.5 text-left text-sm text-slate-300 hover:text-white"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                )}
                <div className="px-4 py-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trending</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TRENDING.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setQuery(term);
                          router.push(`/browse?search=${encodeURIComponent(term)}`);
                          setShowDropdown(false);
                        }}
                        className="viewer-motion-surface viewer-motion-press rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            {showResultsDropdown && (
              <motion.div
                key="results-dropdown"
                className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/92 shadow-2xl backdrop-blur-2xl"
                variants={viewerDropdownVariants()}
                initial={prefersReducedMotion ? false : "hidden"}
                animate="visible"
                exit="exit"
              >
                {loading && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </div>
                )}
                {!loading && suggestions.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500">No quick matches — press Search for full results</p>
                )}
                {!loading &&
                  suggestions.map((hit) => (
                    <Link
                      key={hit.id}
                      href={`/browse/content/${hit.id}`}
                      onClick={() => setShowDropdown(false)}
                      className="viewer-motion-surface flex items-center gap-3 px-4 py-2.5 hover:bg-white/5"
                    >
                      <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-slate-800">
                        {hit.posterUrl ? (
                          <Image src={hit.posterUrl} alt="" fill className="object-cover" sizes="32px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Film className="h-4 w-4 text-slate-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{hit.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {hit.type}
                          {hit.category ? ` · ${hit.category}` : ""}
                          {hit.creatorName ? ` · ${hit.creatorName}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                {!loading && suggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => submitSearch()}
                    className="w-full border-t border-white/10 px-4 py-2.5 text-left text-sm font-medium text-orange-300 hover:bg-white/5"
                  >
                    See all results for &ldquo;{query.trim()}&rdquo;
                  </button>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="viewer-motion-surface rounded-2xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white shadow-panel backdrop-blur-xl focus:border-orange-400/40 focus:outline-none"
            aria-label="Content type filter"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.value || "all"} value={t.value} className="bg-slate-900">
                {t.label}
              </option>
            ))}
          </select>
          {filter && <input type="hidden" name="filter" value={filter} />}
          <motion.button
            type="submit"
            whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={viewerSprings.lift}
            className="viewer-motion-surface viewer-btn-primary rounded-2xl px-5 py-3 font-semibold transition hover:-translate-y-0.5"
          >
            Search
          </motion.button>
        </form>
      </div>

      {modoc && (
        <div className="relative flex items-center justify-center group">
          <motion.button
            type="button"
            onClick={() => setModocOpen(true)}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.06, y: -2 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
            transition={viewerSprings.chip}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.85),rgba(251,146,60,0.82))] shadow-[0_10px_30px_rgba(14,165,233,0.35)] hover:shadow-[0_14px_35px_rgba(14,165,233,0.45)]"
            aria-label="Ask AI"
          >
            <Bot className="w-6 h-6 text-white" />
          </motion.button>
          <span className="pointer-events-none absolute left-full z-10 ml-3 whitespace-nowrap rounded-xl border border-white/10 bg-black/95 px-3 py-1.5 text-sm font-medium text-white opacity-0 shadow-panel transition-opacity duration-200 group-hover:opacity-100">
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
