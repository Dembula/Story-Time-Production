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
};

type IndustryNewsPayload = {
  articles: IndustryNewsArticle[];
  sources: Array<{ name: string; host: string; count: number }>;
  fetchedAt: string;
  refreshed: boolean;
  staleAfterMinutes: number;
  queryFocus: string;
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

  useEffect(() => {
    if (!expanded || fullText || fullError || loadingFull) return;
    let cancelled = false;
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
        if (cancelled) return;
        if (json.ok && json.text) {
          setFullText(json.text);
          setFullError(null);
        } else {
          setFullError(json.error || "Full text unavailable — open the source below.");
        }
      })
      .catch(() => {
        if (!cancelled) setFullError("Could not load the full article. Open the source instead.");
      })
      .finally(() => {
        if (!cancelled) setLoadingFull(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, article.url, fullText, fullError, loadingFull]);

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-orange-400/25 hover:bg-orange-500/[0.04]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300/80">
            {article.sourceName}
            {article.publishedLabel ? ` · ${article.publishedLabel}` : ""}
          </p>
          <h3 className="mt-1.5 text-sm font-semibold leading-snug text-white">{article.title}</h3>
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

              {loadingFull ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
                  Loading full article…
                </div>
              ) : null}

              {fullText ? (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-white/8 bg-black/30 p-3 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {fullText}
                </div>
              ) : null}

              {fullError && !fullText ? (
                <p className="text-xs text-amber-200/90">{fullError}</p>
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-400/30 bg-orange-500/10 px-2.5 py-1.5 text-[11px] font-medium text-orange-200 hover:bg-orange-500/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open original
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
    if (!open) return;
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => {
    setRefreshing(true);
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
            className="fixed inset-0 z-[1988] bg-black/60 backdrop-blur-sm"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="industry-news-title"
            className="fixed inset-y-0 left-0 z-[1990] flex w-full max-w-md flex-col border-r border-orange-500/20 bg-gradient-to-b from-slate-950 via-slate-950 to-black shadow-2xl shadow-orange-500/10"
            initial={prefersReducedMotion ? false : { x: "-100%" }}
            animate={{ x: 0 }}
            exit={prefersReducedMotion ? undefined : { x: "-100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-orange-500/15 bg-orange-500/[0.06] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/80">
                  Creator briefing
                </p>
                <h2
                  id="industry-news-title"
                  className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-white"
                >
                  <Newspaper className="h-5 w-5 text-orange-400" />
                  SA film news
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Live updates for the South African screen industry — funding, festivals,
                  production, and distribution.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={refreshing || isFetching}
                  className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                  title="Refresh news"
                  aria-label="Refresh news"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing || isFetching ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex items-center justify-between gap-2 border-b border-white/8 px-5 py-2.5 text-[11px] text-slate-500">
              <span>
                {updatedLabel ? `Updated ${updatedLabel}` : "Fetching…"}
                {data?.staleAfterMinutes
                  ? ` · refreshes about every ${data.staleAfterMinutes} min`
                  : ""}
              </span>
              <span className="text-slate-600">{articles.length} stories</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {isLoading ? (
                <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                  Gathering South African film industry updates…
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
              <footer className="shrink-0 border-t border-white/10 bg-black/40 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sources in this briefing
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
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
                  Headlines are aggregated from public web sources. Always verify details on the
                  original outlet before acting on funding or festival dates.
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
