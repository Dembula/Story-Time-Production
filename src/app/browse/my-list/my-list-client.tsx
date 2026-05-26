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
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-8 md:px-12 md:pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-white">My List</h1>
        <p className="mt-2 text-slate-400">Everything you saved for later.</p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 py-16 text-center">
          <Bookmark className="mx-auto mb-4 h-10 w-10 text-slate-600" />
          <p className="text-slate-300">Your list is empty</p>
          <Link href="/browse" className="mt-4 inline-block text-sm text-orange-300 hover:text-orange-200">
            Discover titles →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map(({ content: c }) => {
            const poster = getDisplayPosterUrl(c) ?? c.posterUrl;
            return (
              <Link key={c.id} href={`/browse/content/${c.id}`} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 shadow-media transition duration-300 group-hover:scale-[1.02]">
                  {poster ? (
                    <Image src={poster} alt={c.title} fill sizes="(max-width:640px) 45vw, 200px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-900">
                      <Play className="h-8 w-8 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="mt-2 truncate text-sm font-medium text-white">{c.title}</p>
                <p className="truncate text-xs text-slate-500">{c.type}{c.category ? ` · ${c.category}` : ""}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
