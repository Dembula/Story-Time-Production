"use client";

import Link from "next/link";
import { SearchX, Sparkles } from "lucide-react";

type Props = {
  query: string;
};

export function SearchNotFound({ query }: Props) {
  return (
    <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
      <SearchX className="mx-auto mb-4 h-10 w-10 text-slate-500" />
      <h2 className="text-xl font-semibold text-white">
        We couldn&apos;t find &ldquo;{query}&rdquo;
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        If you&apos;re looking for this title, it doesn&apos;t appear to be in our catalogue yet.
        Try checking the spelling, using different keywords, or ask MODOC for recommendations on similar films.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/browse/search"
          className="rounded-xl border border-white/12 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
        >
          Clear search
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("modoc:open-viewer"))}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/16"
        >
          <Sparkles className="h-4 w-4" />
          Ask MODOC
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        New titles are added regularly — check back soon.
      </p>
    </div>
  );
}
