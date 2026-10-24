"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

export type IndustryNewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  sourceHost: string;
  publishedLabel: string | null;
  publishedAt?: string | null;
  kind?: "article" | "hub";
};

type IndustryNewsPayload = {
  articles: IndustryNewsArticle[];
  sources: Array<{ name: string; host: string; count: number }>;
  fetchedAt: string;
  refreshed: boolean;
  staleAfterMinutes: number;
  queryFocus: string;
  liveCount?: number;
  providerNote?: string | null;
};

type IndustryNewsPanelProps = {
  open: boolean;
  onClose: () => void;
};

const QUERY_KEY = ["creator-industry-news"] as const;

function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Just now";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ArticleCard({
  article,
  expanded,
  onToggle,
}: {
  article: IndustryNewsArticle;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [fullText, setFullText] = useState<string | null>(null);
  const [fullError, setFullError] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const isHub = article.kind === "hub";

  useEffect(() => {
    if (!expanded) return;
    if (isHub) {
      setLoadingFull(false);
      setFullError(null);
      return;
    }
    if (fullText || fullError || loadingFull) return;

    let cancelled = false;
    let settled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || settled) return;
      settled = true;
      setLoadingFull(false);
      setFullError((prev) => prev || "Taking too long — open the original to read the full piece.");
    }, 9000);

    setLoadingFull(true);
    fetch("/api/creator/industry-news/article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: article.url }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          text?: string;
          error?: string;
        };
        if (cancelled || settled) return;
        settled = true;
        if (json.ok && json.text) {
          setFullText(json.text);
          setFullError(null);
        } else {
          setFullError(json.error || "Full text unavailable on this publisher.");
        }
      })
      .catch(() => {
        if (cancelled || settled) return;
        settled = true;
        setFullError("Could not load in-app. Open the original instead.");
      })
      .finally(() => {
        if (!cancelled) setLoadingFull(false);
        window.clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per expand
  }, [expanded, article.url, isHub]);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] shadow-sm shadow-black/20 transition hover:border-orange-400/30 hover:from-orange-500/[0.07] hover:to-white/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-orange-400/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200">
              {article.sourceName}
            </span>
            {article.publishedLabel ? (
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {article.publishedLabel}
              </span>
            ) : null}
            {isHub ? (
              <span className="text-[10px] uppercase tracking-wide text-slate-600">Hub</span>
            ) : null}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-white">{article.title}</h3>
          {!expanded ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{article.summary}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition ${expanded ? "rotate-180 text-orange-300" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-white/8 px-4 pb-4 pt-3">
              <p className="text-sm leading-relaxed text-slate-300">{article.summary}</p>

              {!isHub && loadingFull ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
                  Pulling full article…
                </div>
              ) : null}

              {fullText ? (
                <div className="max-h-80 overflow-y-auto rounded-xl border border-white/8 bg-black/35 p-3.5 text-[13px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {fullText}
                </div>
              ) : null}

              {(fullError || isHub) && !fullText ? (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
                  {isHub
                    ? "This is a publisher hub. Open the original site to browse their latest stories."
                    : fullError}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
                <p className="text-[11px] text-slate-500">
                  Source: <span className="text-slate-300">{article.sourceName}</span>
                  {article.sourceHost ? (
                    <span className="text-slate-600"> · {article.sourceHost}</span>
                  ) : null}
                </p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isHub ? "Visit hub" : "Read full story"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

export function IndustryNewsPanel({ open, onClose }: IndustryNewsPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setExpandedId(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/creator/industry-news");
      if (!res.ok) throw new Error("Failed to load industry news");
      return (await res.json()) as IndustryNewsPayload;
    },
    enabled: open,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setExpandedId(null);
    try {
      const res = await fetch("/api/creator/industry-news?refresh=1");
      if (!res.ok) throw new Error("Refresh failed");
      const payload = (await res.json()) as IndustryNewsPayload;
      queryClient.setQueryData(QUERY_KEY, payload);
    } catch {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetch]);

  const articles = data?.articles ?? [];
  const sources = data?.sources ?? [];
  const updatedLabel = useMemo(
    () => (data?.fetchedAt ? formatFetchedAt(data.fetchedAt) : null),
    [data?.fetchedAt],
  );

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close industry news"
            className="fixed inset-0 z-[1988] bg-black/65 backdrop-blur-sm"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="industry-news-title"
            className="fixed inset-y-0 left-0 z-[1990] flex w-full max-w-[26rem] flex-col border-r border-orange-500/25 bg-gradient-to-b from-[#0b0f16] via-slate-950 to-black shadow-2xl shadow-orange-500/15"
            initial={prefersReducedMotion ? false : { x: "-100%" }}
            animate={{ x: 0 }}
            exit={prefersReducedMotion ? undefined : { x: "-100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="relative shrink-0 overflow-hidden border-b border-orange-500/20 px-5 pb-4 pt-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(249,115,22,0.18),transparent_55%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
                    Creator briefing
                  </p>
                  <h2
                    id="industry-news-title"
                    className="mt-1.5 flex items-center gap-2 font-display text-xl font-semibold text-white"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-orange-400/30 bg-orange-500/15">
                      <Newspaper className="h-4 w-4 text-orange-400" />
                    </span>
                    SA film news
                  </h2>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
                    Fresh South African screen industry coverage — funding, festivals, production,
                    and distribution from many outlets.
                  </p>
                </div>
                <div className="relative flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={refreshing || isFetching}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                    title="Refresh news"
                    aria-label="Refresh news"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing || isFetching ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-5 py-2.5 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-orange-400/80" />
                {updatedLabel ? `Updated ${updatedLabel}` : "Fetching…"}
              </span>
              <span className="text-slate-400">
                {articles.length} stories
                {typeof data?.liveCount === "number" ? (
                  <span className="text-slate-600"> · {data.liveCount} live</span>
                ) : null}
              </span>
            </div>

            {data?.providerNote ? (
              <div className="border-b border-amber-400/20 bg-amber-500/10 px-5 py-2 text-[11px] text-amber-100/90">
                {data.providerNote}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {isLoading ? (
                <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-sm text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
                  Gathering stories from South African film outlets…
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
                  Could not load industry news. Try refresh.
                </div>
              ) : articles.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
                  No stories right now. Hit refresh in a moment.
                </div>
              ) : (
                <ul className="space-y-3">
                  {articles.map((article) => (
                    <li key={article.id}>
                      <ArticleCard
                        article={article}
                        expanded={expandedId === article.id}
                        onToggle={() =>
                          setExpandedId((id) => (id === article.id ? null : article.id))
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {sources.length > 0 ? (
              <footer className="shrink-0 border-t border-white/10 bg-black/50 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sources in this briefing ({sources.length})
                </p>
                <div className="mt-2.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {sources.map((s) => (
                    <span
                      key={s.host || s.name}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300"
                      title={s.host || undefined}
                    >
                      {s.name}
                      <span className="ml-1 text-slate-600">{s.count}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
                  Aggregated from public news feeds. Always verify funding dates and festival
                  details on the original outlet.
                </p>
              </footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
