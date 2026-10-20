"use client";

import { useMemo } from "react";
import { Film, Play } from "lucide-react";
import { packBrowserMediaUrl } from "@/lib/pack-storage-media-url";
import { resolveNativeVideoSafeUrl } from "@/lib/playback-sources";

export function FestivalScreenerPlayer({
  url,
  title,
  onEnded,
  className = "",
}: {
  url?: string | null;
  title?: string | null;
  onEnded?: () => void;
  className?: string;
}) {
  const safeSrc = useMemo(() => {
    const raw = url?.trim();
    if (!raw) return null;
    const packed =
      /^https?:\/\//i.test(raw) ? raw : packBrowserMediaUrl(raw) ?? null;
    if (!packed) return null;
    return resolveNativeVideoSafeUrl(packed) ?? (/^https?:\/\//i.test(packed) ? packed : null);
  }, [url]);

  if (!safeSrc) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-slate-950 via-slate-900 to-black ${className}`}
      >
        <div className="aspect-video flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-orange-500/25 bg-orange-500/10">
            {url ? <Film className="h-6 w-6 text-orange-300" /> : <Play className="h-6 w-6 text-orange-300" />}
          </div>
          <p className="font-display text-base font-semibold text-white">
            {url ? "Screener can’t play in-browser" : "No screener yet"}
          </p>
          <p className="max-w-sm text-sm text-slate-400">
            {url
              ? "This link isn’t a playable MP4/Stream URL. Open it externally or ask the filmmaker for a direct screener."
              : "Add a screener URL on the submission to watch during review."}
          </p>
          {url && /^https?:\/\//i.test(url) ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-orange-200 hover:border-orange-500/40"
            >
              Open screener link
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/8 bg-black shadow-panel ${className}`}>
      <video
        key={safeSrc}
        src={safeSrc}
        controls
        playsInline
        className="aspect-video w-full bg-black"
        onEnded={onEnded}
      />
      {title ? (
        <div className="border-t border-white/8 px-4 py-3">
          <p className="font-medium text-white">{title}</p>
        </div>
      ) : null}
    </div>
  );
}
