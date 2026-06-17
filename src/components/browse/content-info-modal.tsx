"use client";

import { X, Calendar, Clock, Globe, Tag, Film, Shield, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

type Advisory = Record<string, boolean | string> | null | undefined;

type Props = {
  open: boolean;
  onClose: () => void;
  content: {
    title: string;
    type: string;
    category: string | null;
    description: string | null;
    year: number | null;
    duration: number | null;
    language: string | null;
    country: string | null;
    ageRating: string | null;
    minAge?: number;
    advisory?: Advisory;
    tags: string | null;
    createdAt: string;
    submittedAt: string | null;
    creatorName: string | null;
    isStudentWork?: boolean;
    episodes?: number | null;
  };
};

function formatDuration(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const TYPE_LABELS: Record<string, string> = {
  MOVIE: "Movie",
  SERIES: "Series",
  SHOW: "Show",
  PODCAST: "Podcast",
  DOCUMENTARY: "Documentary",
  SHORT_FILM: "Short Film",
};

export function ContentInfoModal({ open, onClose, content }: Props) {
  const { deviceClass, inputMode } = useAdaptiveUi();
  const isMobile = deviceClass === "mobile";
  const isTv = deviceClass === "tv";
  const isRemote = inputMode === "remote";
  const advisories = content.advisory && typeof content.advisory === "object"
    ? Object.entries(content.advisory)
        .filter(([k, v]) => k !== "themes" && v === true)
        .map(([k]) => k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()))
    : [];

  const themes = content.advisory && typeof content.advisory === "object" && typeof content.advisory.themes === "string"
    ? content.advisory.themes.trim()
    : "";

  const rows = [
    { icon: Film, label: "Type", value: TYPE_LABELS[content.type] ?? content.type },
    content.category ? { icon: Tag, label: "Genre", value: content.category } : null,
    content.year ? { icon: Calendar, label: "Release year", value: String(content.year) } : null,
    formatDuration(content.duration) ? { icon: Clock, label: "Runtime", value: formatDuration(content.duration)! } : null,
    content.language ? { icon: Globe, label: "Language", value: content.language } : null,
    content.country ? { icon: Globe, label: "Country", value: content.country } : null,
    content.ageRating ? { icon: Shield, label: "Age rating", value: content.ageRating } : null,
    content.minAge != null && content.minAge > 0 ? { icon: Shield, label: "Minimum age", value: `${content.minAge}+` } : null,
    formatDate(content.submittedAt) ? { icon: Upload, label: "Submitted", value: formatDate(content.submittedAt)! } : null,
    formatDate(content.createdAt) ? { icon: Calendar, label: "Added to Story Time", value: formatDate(content.createdAt)! } : null,
    content.creatorName ? { icon: Film, label: "Creator", value: content.creatorName } : null,
    content.episodes ? { icon: Film, label: "Episodes", value: String(content.episodes) } : null,
  ].filter(Boolean) as { icon: typeof Film; label: string; value: string }[];

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = "hidden";
    // Prevent horizontal layout shift when scrollbar disappears.
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[3200] bg-black/80"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed z-[3201] mx-auto overflow-y-auto border border-white/12 bg-[#0c0c0e]/98 shadow-2xl backdrop-blur-2xl ${
              isMobile
                ? "inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] max-h-none rounded-t-2xl border-x-0 border-b-0"
                : isTv
                  ? "left-1/2 top-[8vh] w-full max-w-3xl -translate-x-1/2 max-h-[84vh] rounded-3xl"
                  : "inset-x-4 top-[8vh] max-h-[84vh] max-w-2xl rounded-2xl md:inset-x-auto md:left-1/2 md:w-full md:-translate-x-1/2"
            }`}
            initial={{ opacity: 1, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <div className="sticky top-0 flex items-start justify-between border-b border-white/8 bg-[#0c0c0e]/95 px-5 py-4 backdrop-blur-xl">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/80">About this title</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-white">{content.title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white ${
                  isRemote ? "adaptive-interactive min-h-[44px] min-w-[44px]" : ""
                } ${isTv ? "p-3" : ""}`}
                aria-label="Close"
              >
                <X className={isTv ? "h-5 w-5" : "h-4 w-4"} />
              </button>
            </div>

            <div
              className={`space-y-5 px-5 py-5 ${
                isMobile ? "pb-[calc(1.5rem+env(safe-area-inset-bottom))]" : ""
              }`}
            >
              {content.description && (
                <p className="text-sm leading-relaxed text-slate-300">{content.description}</p>
              )}

              {content.isStudentWork && (
                <span className="inline-flex rounded-full border border-teal-400/25 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
                  Student Film
                </span>
              )}

              <dl className="space-y-3">
                {rows.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
                      <dd className="text-sm text-white">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              {content.tags && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {content.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(advisories.length > 0 || themes) && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Content advisories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {advisories.map((a) => (
                      <span key={a} className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-200">
                        {a}
                      </span>
                    ))}
                  </div>
                  {themes && <p className="mt-2 text-xs text-slate-400">{themes}</p>}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
