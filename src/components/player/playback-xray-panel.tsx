"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CompanionData = {
  scene: {
    summary: string | null;
    mood: string | null;
    actors: string[];
    startSeconds: number;
    endSeconds: number;
  } | null;
  graph: {
    actors: string[];
    genres: string[];
    themes: string[];
    festivals: string[];
    cast: string[];
    relatedTitles: string[];
  } | null;
  ragSnippets: string[];
  trivia: string[];
  spoilerSafe?: boolean;
  watchProgressPercent?: number;
};

type PlaybackXRayPanelProps = {
  contentId: string;
  /** Current playback position in seconds — polled externally, never blocks player. */
  positionSeconds: number;
  /** Total duration when known — enables spoiler gating. */
  durationSeconds?: number | null;
  enabled?: boolean;
};

export function PlaybackXRayPanel({
  contentId,
  positionSeconds,
  durationSeconds = null,
  enabled = true,
}: PlaybackXRayPanelProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CompanionData | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCompanion = useCallback(
    async (pos: number) => {
      if (!enabled || !open) return;
      const now = Date.now();
      if (now - lastFetchRef.current < 4000) return;
      lastFetchRef.current = now;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const params = new URLSearchParams({
          contentId,
          positionSeconds: String(Math.floor(pos)),
        });
        if (durationSeconds != null && durationSeconds > 0) {
          params.set("durationSeconds", String(Math.floor(durationSeconds)));
        }
        const res = await fetch(`/api/playback/companion?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as CompanionData;
        setData(body);
      } catch {
        /* companion is best-effort — playback unaffected */
      } finally {
        setLoading(false);
      }
    },
    [contentId, durationSeconds, enabled, open],
  );

  useEffect(() => {
    if (open) void fetchCompanion(positionSeconds);
  }, [open, positionSeconds, fetchCompanion]);

  if (!enabled) return null;

  const spoilerLocked = data?.spoilerSafe === true;

  return (
    <div className="pointer-events-auto absolute bottom-20 right-4 z-30 flex max-w-sm flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/85"
        aria-expanded={open}
        aria-label="Toggle X-Ray scene info"
      >
        {open ? "Hide X-Ray" : "X-Ray"}
      </button>

      {open && (
        <div className="max-h-64 w-72 overflow-y-auto rounded-lg border border-white/10 bg-black/80 p-3 text-xs text-white/90 shadow-xl backdrop-blur">
          {loading && !data && <p className="text-white/60">Loading scene context…</p>}

          {spoilerLocked && (
            <p className="mb-2 rounded bg-amber-500/15 px-2 py-1 text-amber-200/90">
              Spoiler-safe mode — watch a little longer to unlock scene summaries (
              {data?.watchProgressPercent ?? 0}% progress).
            </p>
          )}

          {data?.scene && (
            <section className="mb-2">
              <h3 className="mb-1 font-semibold text-white">Now</h3>
              {data.scene.summary ? (
                <p>{data.scene.summary}</p>
              ) : spoilerLocked ? (
                <p className="text-white/50">Scene summary hidden to avoid spoilers.</p>
              ) : null}
              {data.scene.actors.length > 0 && (
                <p className="mt-1 text-white/70">On screen: {data.scene.actors.join(", ")}</p>
              )}
              {data.scene.mood && <p className="mt-1 text-white/60">Mood: {data.scene.mood}</p>}
            </section>
          )}

          {data?.graph && (
            <section className="mb-2">
              {data.graph.genres.length > 0 && (
                <p className="text-white/70">Genres: {data.graph.genres.join(", ")}</p>
              )}
              {!spoilerLocked && data.graph.themes.length > 0 && (
                <p className="mt-1 text-white/60">Themes: {data.graph.themes.join(", ")}</p>
              )}
              {data.graph.cast.length > 0 && (
                <p className="mt-1 text-white/60">Cast: {data.graph.cast.join(", ")}</p>
              )}
              {!spoilerLocked && data.graph.festivals.length > 0 && (
                <p className="mt-1 text-white/50">Festivals: {data.graph.festivals.join(", ")}</p>
              )}
            </section>
          )}

          {data?.trivia && data.trivia.length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold text-white">Context</h3>
              <ul className="list-disc space-y-1 pl-4 text-white/70">
                {data.trivia.slice(0, 4).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {!loading && !data?.scene && !data?.graph?.genres.length && (
            <p className="text-white/50">No scene metadata for this moment yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
