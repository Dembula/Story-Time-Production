"use client";

import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Film } from "lucide-react";
import type { PersonPreview } from "@/lib/credit-person-types";

export function CreditPersonPageClient({ preview }: { preview: PersonPreview }) {
  const initials = preview.displayName
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white/15 bg-slate-800">
          {preview.imageUrl ? (
            <Image src={preview.imageUrl} alt="" fill className="object-cover" sizes="96px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-300">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold text-white sm:justify-start">
            {preview.displayName}
            {preview.verified ? <BadgeCheck className="h-5 w-5 text-sky-400" /> : null}
          </h1>
          <p className="mt-1 text-sm text-orange-200/90">{preview.roles.join(" • ")}</p>
          <p className="mt-2 text-xs text-slate-500">
            {preview.productionCount} Story Time credit{preview.productionCount === 1 ? "" : "s"}
            {preview.followerCount != null ? ` · ${preview.followerCount} followers` : ""}
          </p>
          {preview.isCreator ? (
            <Link
              href={preview.profileHref}
              className="mt-3 inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              Open creator profile
            </Link>
          ) : null}
        </div>
      </div>

      {preview.bio ? <p className="text-sm leading-relaxed text-slate-400">{preview.bio}</p> : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Credits on Story Time</h2>
        <ul className="space-y-2">
          {preview.credits.map((c) => (
            <li key={`${c.contentId}-${c.role}`}>
              <Link
                href={`/browse/content/${c.contentId}`}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 transition hover:border-orange-500/30 hover:bg-white/[0.05]"
              >
                <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-slate-800">
                  {c.posterUrl ? (
                    <Image src={c.posterUrl} alt="" fill className="object-cover" sizes="32px" />
                  ) : (
                    <Film className="m-auto h-4 w-4 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-slate-400">
                    {c.role}
                    {c.year ? ` · ${c.year}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
