"use client";

import { ExternalLink } from "lucide-react";

/** Required Pexels attribution — keep visible wherever search/results appear. */
export function PexelsPoweredBy({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://www.pexels.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300 underline-offset-2 hover:text-white hover:underline ${className}`}
    >
      Photos provided by Pexels
      <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
    </a>
  );
}

export function PexelsPhotoCredit({
  photographer,
  photographerUrl,
  pexelsUrl,
  className = "",
}: {
  photographer: string;
  photographerUrl?: string;
  pexelsUrl?: string;
  className?: string;
}) {
  return (
    <p className={`text-[10px] leading-snug text-slate-500 ${className}`}>
      Photo by{" "}
      {photographerUrl ? (
        <a
          href={photographerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-300 underline-offset-2 hover:underline"
        >
          {photographer}
        </a>
      ) : (
        <span className="text-slate-300">{photographer}</span>
      )}{" "}
      on{" "}
      <a
        href={pexelsUrl || "https://www.pexels.com"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-300 underline-offset-2 hover:underline"
      >
        Pexels
      </a>
    </p>
  );
}
