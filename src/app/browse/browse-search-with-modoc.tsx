"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Film, Loader2, SearchX, Sparkles } from "lucide-react";
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
  /** When true, search UI sticks below the Story Time navbar */
  sticky?: boolean;
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
  { value: "ANIMATION", label: "Animation" },
  { value: "SPORTS", label: "Sports" },
  { value: "COMEDY_SKIT", label: "Comedy" },
  { value: "DOCUMENTARY", label: "Documentaries" },
  { value: "PODCAST", label: "Podcasts" },
  { value: "SHORT_FILM", label: "Short Films" },
  { value: "STAND_UP", label: "Stand-Up" },
  { value: "LIVE_EVENT", label: "Live Events" },
  { value: "MUSIC_VIDEO", label: "Music Videos" },
  { value: "REALITY", label: "Reality" },
  { value: "WEB_SERIES", label: "Web Series" },
  { value: "NEWS", label: "News" },
  { value: "EDUCATIONAL", label: "Educational" },
];

function buildSearchUrl(query: string, contentType: string, filter?: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (contentType) params.set("type", contentType);
  if (filter) params.set("filter", filter);
  const qs = params.toString();
  return qs ? `/browse/search?${qs}` : "/browse/search";
}

export function BrowseSearchWithModoc({ defaultSearch = "", type, filter, sticky = false }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultSearch);
  const [typeFilter, setTypeFilter] = useState(type ?? "");
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { prefersReducedMotion } = useMotion();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();
  const showRecentDropdown = showDropdown && trimmedQuery.length < 2 && (recentSearches.length > 0 || TRENDING.length > 0);
  const showResultsDropdown = showDropdown && trimmedQuery.length >= 2;

  const fetchSuggestions = useCallback(async (q: string, contentType: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const wordCount = q.trim().split(/\s+/).length;
      let endpoint = "/api/browse/suggest";
      if (wordCount >= 3) endpoint = "/api/browse/semantic-search";
      else if (wordCount >= 2 && q.trim().length >= 8) endpoint = "/api/browse/search";

      const params = new URLSearchParams({ q: q.trim(), limit: "8" });
      if (endpoint !== "/api/browse/semantic-search" && contentType) params.set("type", contentType);
      if (endpoint === "/api/browse/search" && contentType) params.set("type", contentType);

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
    setQuery(defaultSearch);
  }, [defaultSearch]);

  useEffect(() => {
    setTypeFilter(type ?? "");
  }, [type]);

  useEffect(() => {
    setRecentSearches(loadRecent());
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query, typeFilter);
    }, 250);
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
    if (trimmedQuery) {
      pushRecent(trimmedQuery);
      setRecentSearches(loadRecent());
    }
    router.push(buildSearchUrl(query, typeFilter, filter));
    setShowDropdown(false);
  }

  const wrapperClass = sticky
    ? "sticky top-16 z-30 -mx-4 border-b border-white/8 bg-background/95 px-4 py-4 backdrop-blur-xl md:-mx-12 md:px-12"
    : "mb-6";

  return (
    <div className={wrapperClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={wrapRef} className="relative flex flex-1 flex-col gap-2">
          <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
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
                placeholder="Search films, series, shows…"
                className="viewer-motion-surface viewer-motion-glow w-full rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-white shadow-panel backdrop-blur-xl placeholder:text-slate-500 focus:border-orange-400/40 focus:outline-none focus:ring-2 focus:ring-orange-500/35"
                autoComplete="off"
                autoFocus={sticky}
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
                              router.push(buildSearchUrl(term, typeFilter, filter));
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
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Popular on Story Time</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TRENDING.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => {
                              setQuery(term);
                              router.push(buildSearchUrl(term, typeFilter, filter));
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
                        <Loader2 className="h-4 w-4 animate-spin" /> Finding titles…
                      </div>
                    )}
                    {!loading && suggestions.length === 0 && (
                      <div className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              We don&apos;t have &ldquo;{trimmedQuery}&rdquo; in our catalogue
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">
                              If you&apos;re looking for this title, it may not be available on Story Time yet.
                              Try a different spelling, or ask MODOC for similar recommendations.
                            </p>
                          </div>
                        </div>
                      </div>
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
                        See all results for &ldquo;{trimmedQuery}&rdquo;
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="viewer-motion-surface min-w-0 flex-1 rounded-2xl border border-white/12 bg-white/[0.04] px-3 py-3 text-sm text-white shadow-panel backdrop-blur-xl focus:border-orange-400/40 focus:outline-none sm:flex-none"
                aria-label="Content type filter"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.value || "all"} value={t.value}>
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
                className="viewer-motion-surface viewer-btn-primary shrink-0 rounded-2xl px-5 py-3 font-semibold transition hover:-translate-y-0.5"
              >
                Search
              </motion.button>
            </div>
          </form>
        </div>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("modoc:open-viewer"))}
          className="viewer-motion-surface viewer-motion-glow flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-200 shadow-panel backdrop-blur-xl transition hover:border-cyan-400/40 hover:bg-cyan-500/16 sm:w-auto"
          title="Ask MODOC — search by scene, mood, or recommendation"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>Ask MODOC</span>
        </button>
      </div>
    </div>
  );
}
