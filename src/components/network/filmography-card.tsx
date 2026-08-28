import Link from "next/link";
import Image from "next/image";
import { Film } from "lucide-react";
import type { NetworkFilmographyItem } from "@/lib/network-filmography";

function formatType(type: string) {
  return type.replace(/_/g, " ");
}

export function FilmographyCard({ item }: { item: NetworkFilmographyItem }) {
  return (
    <Link
      href={`/browse/content/${item.contentId}`}
      className="group flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 transition hover:border-orange-500/35 hover:bg-white/[0.06]"
    >
      <div className="relative h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-md bg-slate-800 shadow-inner">
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt="" fill className="object-cover" sizes="48px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-4 w-4 text-slate-600" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white group-hover:text-orange-200">{item.title}</p>
        <p className="mt-0.5 text-xs text-orange-300/90">{item.role}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
          {formatType(item.type)}
          {item.year ? ` · ${item.year}` : ""}
        </p>
      </div>
    </Link>
  );
}

export function FilmographyPosterStrip({
  items,
  size = "md",
}: {
  items: NetworkFilmographyItem[];
  size?: "sm" | "md";
}) {
  if (items.length === 0) return null;

  const dim = size === "sm" ? "h-14 w-10" : "h-16 w-11";

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link
          key={item.contentId}
          href={`/browse/content/${item.contentId}`}
          title={`${item.title} — ${item.role}`}
          className={`relative ${dim} shrink-0 overflow-hidden rounded-md border border-slate-700/80 bg-slate-800 transition hover:border-orange-500/50 hover:ring-1 hover:ring-orange-500/30`}
        >
          {item.posterUrl ? (
            <Image src={item.posterUrl} alt="" fill className="object-cover" sizes="44px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="h-3.5 w-3.5 text-slate-600" />
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
