import type { PlaybackCompanionPayload } from "./companion";

export type SpoilerGateOptions = {
  positionSeconds: number;
  durationSeconds: number | null;
  /** Strict hides all future scene content; moderate allows themes/genres only. */
  mode?: "strict" | "moderate";
};

/** Minimum watch progress before narrative spoilers are shown (default 8%). */
export function watchProgressRatio(positionSeconds: number, durationSeconds: number | null): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.min(1, positionSeconds / durationSeconds);
}

export function shouldRevealSpoilers(options: SpoilerGateOptions): boolean {
  const ratio = watchProgressRatio(options.positionSeconds, options.durationSeconds);
  const threshold = parseFloat(process.env.AI_SPOILER_PROGRESS_THRESHOLD ?? "0.08");
  return ratio >= threshold;
}

/** Strip future plot details from companion payload for spoiler-safe X-Ray. */
export function applySpoilerGate(
  payload: PlaybackCompanionPayload,
  options: SpoilerGateOptions,
): PlaybackCompanionPayload & { spoilerSafe: boolean; watchProgressPercent: number } {
  const ratio = watchProgressRatio(options.positionSeconds, options.durationSeconds);
  const reveal = shouldRevealSpoilers(options);
  const mode = options.mode ?? "strict";

  if (reveal && mode !== "strict") {
    return {
      ...payload,
      spoilerSafe: false,
      watchProgressPercent: Math.round(ratio * 100),
    };
  }

  if (reveal) {
    return {
      ...payload,
      spoilerSafe: false,
      watchProgressPercent: Math.round(ratio * 100),
    };
  }

  const safeScene = payload.scene
    ? {
        ...payload.scene,
        summary: mode === "strict" ? null : payload.scene.summary?.slice(0, 80) ?? null,
      }
    : null;

  return {
    ...payload,
    scene: safeScene,
    ragSnippets: [],
    trivia: payload.trivia.filter(
      (t) => !t.toLowerCase().includes("related titles") && !t.toLowerCase().includes("plot"),
    ),
    graph: payload.graph
      ? {
          actors: payload.scene?.actors ?? payload.graph.actors.slice(0, 3),
          genres: payload.graph.genres,
          themes: mode === "moderate" ? payload.graph.themes : [],
          festivals: [],
          cast: payload.graph.cast.slice(0, 3),
          relatedTitles: [],
        }
      : null,
    spoilerSafe: true,
    watchProgressPercent: Math.round(ratio * 100),
  };
}
