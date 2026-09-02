import { isLongFormType } from "@/lib/content-types";

export type CatalogueSeasonEpisodeInput = {
  episodeNumber?: number;
  title?: string;
  videoUrl?: string | null;
};

export type CatalogueSeasonInput = {
  seasonNumber?: number;
  episodes?: CatalogueSeasonEpisodeInput[];
};

export type CatalogueMediaPayload = {
  type?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null;
  seasons?: CatalogueSeasonInput[] | null;
};

export type CatalogueMediaRequirement = {
  longForm: boolean;
  requiresMainVideo: boolean;
  requiresPoster: boolean;
  requiresBackdrop: boolean;
  requiresEpisodes: boolean;
  /** Podcasts may ship video or audio episode masters. */
  allowsAudioMasters: boolean;
  masterAccept: string;
  episodeAccept: string;
  masterHint: string;
};

/** Canonical media rules for every catalogue content type. */
export function getCatalogueMediaRequirements(type: string | null | undefined): CatalogueMediaRequirement {
  const normalized = String(type ?? "").trim().toUpperCase();
  const longForm = isLongFormType(normalized);
  const allowsAudioMasters = normalized === "PODCAST" || normalized === "NEWS";

  if (longForm) {
    return {
      longForm: true,
      requiresMainVideo: false,
      requiresPoster: true,
      requiresBackdrop: true,
      requiresEpisodes: true,
      allowsAudioMasters,
      masterAccept: allowsAudioMasters ? "video/*,audio/*" : "video/*",
      episodeAccept: allowsAudioMasters ? "video/*,audio/*" : "video/*",
      masterHint: allowsAudioMasters
        ? "Upload each episode as video (MP4/MOV) or audio (MP3/AAC/WAV). Video encodes to Stream; audio stays on secure storage for playback."
        : "Upload each episode master as MP4 H.264 + AAC (or MOV). Stream encodes after upload.",
    };
  }

  return {
    longForm: false,
    requiresMainVideo: true,
    requiresPoster: false,
    requiresBackdrop: false,
    requiresEpisodes: false,
    allowsAudioMasters,
    masterAccept: allowsAudioMasters ? "video/*,audio/*" : "video/*",
    episodeAccept: "video/*",
    masterHint: allowsAudioMasters
      ? "Upload a video or audio master. Large files use multipart upload."
      : "Delivery master: MP4 H.264 + AAC, under ~180 Mbps average (not ProRes/uncompressed). Large files up to ~50GB use multipart upload; Stream encodes after upload.",
  };
}

function hasUrl(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Missing human-readable labels for Media & Assets (step 3) and submit guards. */
export function getMissingCatalogueMedia(payload: CatalogueMediaPayload): string[] {
  const type = String(payload.type ?? "").trim();
  if (!type) return ["Select a content type"];

  const req = getCatalogueMediaRequirements(type);
  const missing: string[] = [];

  if (req.requiresPoster && !hasUrl(payload.posterUrl)) {
    missing.push("Poster (used in browse catalogue)");
  }
  if (req.requiresBackdrop && !hasUrl(payload.backdropUrl)) {
    missing.push("Backdrop image (used on the title page)");
  }

  if (req.requiresMainVideo && !hasUrl(payload.videoUrl)) {
    missing.push("Main video / master upload");
  }

  if (req.requiresEpisodes) {
    const seasons = Array.isArray(payload.seasons) ? payload.seasons : [];
    const episodes = seasons.flatMap((season) => season.episodes ?? []);
    if (episodes.length === 0) {
      missing.push("At least one episode with a master file");
    } else {
      const missingEps = episodes.filter((ep) => !hasUrl(ep.videoUrl)).length;
      if (missingEps > 0) {
        missing.push(
          missingEps === episodes.length
            ? "Episode masters (upload each episode file)"
            : `${missingEps} episode master${missingEps === 1 ? "" : "s"}`,
        );
      }
    }
  }

  return missing;
}

/**
 * Server-side gate before catalogue create/update.
 * Drafts may omit masters; final submit must satisfy type requirements.
 */
export function assertCatalogueMediaForSubmit(
  payload: CatalogueMediaPayload,
  options?: { isDraft?: boolean },
): { ok: true } | { ok: false; error: string } {
  if (options?.isDraft) return { ok: true };
  const missing = getMissingCatalogueMedia(payload);
  if (missing.length === 0) return { ok: true };
  return {
    ok: false,
    error: `Missing required media for this format: ${missing.join("; ")}.`,
  };
}

/** True when payload still needs masters after URL patching (used by upload finalize). */
export function catalogueFinalizePayloadReady(
  payload: Record<string, unknown>,
): { ready: true } | { ready: false; error: string } {
  const isDraft = String(payload.reviewStatus ?? "DRAFT") === "DRAFT";
  const check = assertCatalogueMediaForSubmit(
    {
      type: typeof payload.type === "string" ? payload.type : null,
      videoUrl: typeof payload.videoUrl === "string" ? payload.videoUrl : null,
      posterUrl: typeof payload.posterUrl === "string" ? payload.posterUrl : null,
      backdropUrl: typeof payload.backdropUrl === "string" ? payload.backdropUrl : null,
      seasons: Array.isArray(payload.seasons) ? (payload.seasons as CatalogueSeasonInput[]) : null,
    },
    { isDraft },
  );
  if (!check.ok) return { ready: false, error: check.error };
  return { ready: true };
}
