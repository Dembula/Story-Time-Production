"use client";

import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Film, Loader2 } from "lucide-react";
import type { PersonPreview } from "@/lib/credit-person-types";

type PersonCardPreviewProps = {
  preview: PersonPreview | null;
  loading?: boolean;
  compact?: boolean;
  className?: string;
};

export function PersonCardPreview({ preview, loading, compact, className = "" }: PersonCardPreviewProps) {
  if (loading && !preview) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-md ${className}`}
        role="status"
        aria-label="Loading profile"
      >
        <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!preview) return null;

  const initials = preview.displayName
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rolesLabel = preview.roles.slice(0, 4).join(" • ");

  return (
    <div
      className={`rounded-xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md ${compact ? "w-[17rem]" : "w-[19rem]"} ${className}`}
      role="region"
      aria-label={`${preview.displayName} profile preview`}
    >
      <div className="flex gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/15 bg-slate-800">
          {preview.imageUrl ? (
            <Image src={preview.imageUrl} alt="" fill className="object-cover" sizes="56px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-300">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-white">
            {preview.displayName}
            {preview.verified ? (
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verified creator" />
            ) : null}
          </p>
          {rolesLabel ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-orange-200/90">{rolesLabel}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-slate-500">
            {preview.productionCount} production{preview.productionCount === 1 ? "" : "s"}
            {preview.followerCount != null ? ` · ${preview.followerCount} followers` : ""}
          </p>
        </div>
      </div>

      {preview.bio ? (
        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-400">{preview.bio}</p>
      ) : null}

      {preview.latestProject ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] p-2">
          <Film className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <p className="min-w-0 truncate text-[11px] text-slate-300">
            Latest: <span className="text-white">{preview.latestProject.title}</span>
          </p>
        </div>
      ) : null}

      {preview.topGenres.length > 0 ? (
        <p className="mt-2 text-[10px] text-slate-500">Genres: {preview.topGenres.join(", ")}</p>
      ) : null}

      <Link
        href={preview.profileHref}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-orange-600"
      >
        View profile
      </Link>
    </div>
  );
}
