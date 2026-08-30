"use client";

import { useCallback, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PexelsPhotoCredit, PexelsPoweredBy } from "@/components/pexels/pexels-attribution";

export const PEXELS_PHOTO_MIME = "application/x-pexels-photo";

export type PexelsBrowserPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographerUrl: string;
  alt: string;
  avgColor: string;
  src: {
    tiny: string;
    small: string;
    medium: string;
    large: string;
    large2x: string;
  };
};

export type PexelsImportedAsset = {
  storageUrl: string;
  storageRef: string;
  title: string;
  caption: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
  pexelsId: number;
  previewUrl: string;
};

type PexelsMediaBrowserProps = {
  /** Visual planning: choose category before import. Treatment: omit. */
  categorySlot?: React.ReactNode;
  primaryActionLabel?: string;
  onImport: (asset: PexelsImportedAsset, photo: PexelsBrowserPhoto) => void | Promise<void>;
  /** Compact styling for treatment side panel */
  variant?: "panel" | "catalogue";
  emptyHint?: string;
  allowDrag?: boolean;
};

export function PexelsMediaBrowser({
  categorySlot,
  primaryActionLabel = "Add photo",
  onImport,
  variant = "catalogue",
  emptyHint = "Search Pexels for reference stills — lighting, locations, faces, atmosphere.",
  allowDrag = true,
}: PexelsMediaBrowserProps) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [photos, setPhotos] = useState<PexelsBrowserPhoto[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const runSearch = useCallback(async (q: string, pageNum: number, append: boolean) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setError("Enter a search term.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        query: trimmed,
        page: String(pageNum),
        perPage: variant === "panel" ? "15" : "24",
      });
      const res = await fetch(`/api/pexels/search?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Search failed");
      }
      const list = ((data as { photos?: PexelsBrowserPhoto[] }).photos ?? []) as PexelsBrowserPhoto[];
      setPhotos((prev) => (append ? [...prev, ...list] : list));
      setTotalResults((data as { totalResults?: number }).totalResults ?? 0);
      setNextPage((data as { nextPage?: number | null }).nextPage ?? null);
      setPage(pageNum);
      setSubmitted(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      if (!append) setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [variant]);

  const importPhoto = async (photo: PexelsBrowserPhoto) => {
    setImportingId(photo.id);
    setError("");
    try {
      const res = await fetch("/api/pexels/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Import failed");
      }
      const asset = (data as { asset: PexelsImportedAsset }).asset;
      await onImport(asset, photo);
      setSelectedId(photo.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportingId(null);
    }
  };

  const isPanel = variant === "panel";

  return (
    <div className={isPanel ? "space-y-3" : "space-y-4"}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${isPanel ? "" : "rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"}`}>
        <PexelsPoweredBy />
        {totalResults > 0 ? (
          <span className="text-[10px] text-slate-500">{totalResults.toLocaleString()} results</span>
        ) : null}
      </div>

      {categorySlot}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(query, 1, false);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pexels…"
            className={
              isPanel
                ? "h-8 border-white/10 bg-black/40 pl-8 text-xs text-white"
                : "h-9 border-slate-700 bg-slate-950 pl-8 text-[11px]"
            }
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={loading || !query.trim()}
          className={
            isPanel
              ? "h-8 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
              : "h-9 bg-orange-500 text-xs text-white hover:bg-orange-600"
          }
          variant={isPanel ? "outline" : "default"}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </form>

      {error ? (
        <p className={`text-[11px] ${isPanel ? "text-red-400" : "text-amber-200/90"}`}>{error}</p>
      ) : null}

      {!submitted && !loading ? (
        <p className={`text-[11px] leading-relaxed ${isPanel ? "text-slate-500" : "text-slate-500"}`}>
          {emptyHint}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <div
          className={
            isPanel
              ? "grid grid-cols-2 gap-2"
              : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          }
        >
          {photos.map((photo) => {
            const busy = importingId === photo.id;
            const selected = selectedId === photo.id;
            return (
              <div
                key={photo.id}
                draggable={allowDrag && !busy}
                onDragStart={(e) => {
                  if (!allowDrag) return;
                  e.dataTransfer.setData(
                    PEXELS_PHOTO_MIME,
                    JSON.stringify({
                      id: photo.id,
                      photographer: photo.photographer,
                      photographerUrl: photo.photographerUrl,
                      url: photo.url,
                      alt: photo.alt,
                      preview: photo.src.medium,
                    }),
                  );
                  e.dataTransfer.setData("text/plain", String(photo.id));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={[
                  "group overflow-hidden rounded-lg border transition",
                  isPanel
                    ? selected
                      ? "border-orange-400/40 bg-orange-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    : selected
                      ? "border-orange-500/50 bg-slate-950 ring-1 ring-orange-500/30"
                      : "border-slate-800 bg-slate-950/80 hover:border-slate-600",
                ].join(" ")}
              >
                <button
                  type="button"
                  className="relative block w-full text-left"
                  disabled={busy}
                  onClick={() => void importPhoto(photo)}
                  title={allowDrag ? "Click to add, or drag onto the canvas" : "Click to add"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src.medium || photo.src.small}
                    alt={photo.alt || `Photo by ${photo.photographer}`}
                    className={isPanel ? "aspect-video w-full object-cover" : "aspect-[4/3] w-full object-cover"}
                    loading="lazy"
                    style={{ backgroundColor: photo.avgColor || undefined }}
                  />
                  {busy ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  ) : null}
                </button>
                <div className="space-y-1 p-2">
                  <PexelsPhotoCredit
                    photographer={photo.photographer}
                    photographerUrl={photo.photographerUrl}
                    pexelsUrl={photo.url}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={
                      isPanel
                        ? "h-7 w-full justify-start px-1 text-[10px] text-slate-300 hover:text-white"
                        : "h-7 w-full justify-start px-1 text-[10px] text-slate-300 hover:text-white hover:bg-slate-800"
                    }
                    disabled={busy}
                    onClick={() => void importPhoto(photo)}
                  >
                    {busy ? "Saving…" : primaryActionLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {nextPage ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            className={
              isPanel
                ? "border-white/15 text-xs text-slate-300"
                : "border-slate-600 text-xs text-slate-200"
            }
            onClick={() => void runSearch(submitted, nextPage, true)}
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export async function importPexelsPhotoClient(photoId: number): Promise<PexelsImportedAsset> {
  const res = await fetch("/api/pexels/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Import failed");
  }
  return (data as { asset: PexelsImportedAsset }).asset;
}
