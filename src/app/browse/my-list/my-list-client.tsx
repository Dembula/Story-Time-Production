"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Play } from "lucide-react";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

export function MyListClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetch("/api/watchlist").then((r) => r.json()),
  });

  const items = (Array.isArray(data) ? data : []) as Array<{
    content: {
      id: string;
      title: string;
      posterUrl: string | null;
      backdropUrl: string | null;
      videoUrl: string | null;
      trailerUrl: string | null;
      category: string | null;
      type: string;
    };
  }>;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-12 md:pb-16 md:pt-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
            <Bookmark className="h-5 w-5 text-orange-300" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-white md:text-3xl">My List</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              {isLoading ? "Loading…" : items.length === 0 ? "Your saved titles will appear here" : `${items.length} saved title${items.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <Bookmark className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <h2 className="text-lg font-semibold text-white">Your list is empty</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
            Save films and series you want to watch by tapping &ldquo;My List&rdquo; on any title.
            They&apos;ll appear here for easy access.
          </p>
          <Link
            href="/browse"
            className="mt-6 inline-flex rounded-xl viewer-btn-primary px-6 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5"
          >
            Browse catalogue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map(({ content: c }) => {
            const poster = getDisplayPosterUrl(c) ?? c.posterUrl;
            return (
              <Link key={c.id} href={`/browse/content/${c.id}`} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 shadow-media transition duration-300 group-hover:scale-[1.02] group-hover:border-white/16">
                  {poster ? (
                    <Image src={poster} alt={c.title} fill sizes="(max-width:640px) 45vw, 200px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-900">
                      <Play className="h-8 w-8 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="absolute bottom-2 left-2 opacity-0 transition group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                      <Play className="h-3 w-3" /> View
                    </span>
                  </div>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-white">{c.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {c.type}{c.category ? ` · ${c.category}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
