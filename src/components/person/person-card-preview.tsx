"use client";

import Image from "next/image";
import { BadgeCheck, Loader2 } from "lucide-react";
import type { PersonPreview } from "@/lib/credit-person-types";

type PersonCardPreviewProps = {
  preview: PersonPreview | null;
  loading?: boolean;
  className?: string;
};

export function PersonCardPreview({ preview, loading, className = "" }: PersonCardPreviewProps) {
  if (loading && !preview) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl ${className}`}
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
  const blurb = preview.blurb ?? preview.bio;

  return (
    <div
      className={`rounded-xl border border-white/15 bg-slate-950/75 p-4 shadow-2xl backdrop-blur-xl ${className}`}
      role="tooltip"
      aria-label={`${preview.displayName} credits`}
    >
      <div className="flex gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/15 bg-slate-800/80">
          {preview.imageUrl ? (
            <Image src={preview.imageUrl} alt="" fill className="object-cover" sizes="48px" />
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
            {preview.productionCount} production{preview.productionCount === 1 ? "" : "s"} on Story Time
          </p>
        </div>
      </div>

      {blurb ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-300/95">{blurb}</p>
      ) : null}
    </div>
  );
}
