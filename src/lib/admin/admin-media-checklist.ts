import {
  getCatalogueMediaRequirements,
  getMissingCatalogueMedia,
  type CatalogueMediaPayload,
} from "@/lib/catalogue-upload/media-requirements";

export type AdminMediaChecklistRow = {
  label: string;
  status: "ok" | "missing" | "na";
  detail?: string;
  url?: string | null;
};

/** Type-aware media rows for admin list/dossier (series = episodes, not main video). */
export function buildAdminMediaChecklist(payload: CatalogueMediaPayload & {
  scriptUrl?: string | null;
}): {
  rows: AdminMediaChecklistRow[];
  missing: string[];
  requirements: ReturnType<typeof getCatalogueMediaRequirements>;
  playable: boolean;
  firstEpisodeId: string | null;
  episodeStats: { total: number; withMaster: number };
} {
  const requirements = getCatalogueMediaRequirements(payload.type);
  const missing = getMissingCatalogueMedia(payload);
  const seasons = Array.isArray(payload.seasons) ? payload.seasons : [];
  const episodes = seasons.flatMap((s) => s.episodes ?? []);
  const withMaster = episodes.filter((ep) => typeof ep.videoUrl === "string" && ep.videoUrl.trim()).length;
  const firstEpisodeId = (() => {
    for (const season of seasons) {
      for (const ep of season.episodes ?? []) {
        if (typeof ep.videoUrl === "string" && ep.videoUrl.trim() && ep.id) {
          return String(ep.id);
        }
      }
    }
    return null;
  })();

  const rows: AdminMediaChecklistRow[] = [];

  if (requirements.requiresMainVideo) {
    rows.push({
      label: "Main Video",
      status: payload.videoUrl?.trim() ? "ok" : "missing",
      url: payload.videoUrl,
    });
  } else {
    rows.push({
      label: "Main Video",
      status: "na",
      detail: "N/A (episode-based title)",
    });
  }

  rows.push({
    label: "Trailer",
    status: payload.trailerUrl?.trim() ? "ok" : "na",
    detail: payload.trailerUrl?.trim() ? undefined : "Optional",
    url: payload.trailerUrl,
  });

  rows.push({
    label: "Poster",
    status: !requirements.requiresPoster
      ? payload.posterUrl?.trim()
        ? "ok"
        : "na"
      : payload.posterUrl?.trim()
        ? "ok"
        : "missing",
    detail: !requirements.requiresPoster && !payload.posterUrl?.trim() ? "Optional" : undefined,
    url: payload.posterUrl,
  });

  rows.push({
    label: "Backdrop",
    status: !requirements.requiresBackdrop
      ? payload.backdropUrl?.trim()
        ? "ok"
        : "na"
      : payload.backdropUrl?.trim()
        ? "ok"
        : "missing",
    detail: !requirements.requiresBackdrop && !payload.backdropUrl?.trim() ? "Optional" : undefined,
    url: payload.backdropUrl,
  });

  if (requirements.requiresEpisodes) {
    rows.push({
      label: "Episodes",
      status: withMaster > 0 && withMaster === episodes.length && episodes.length > 0 ? "ok" : "missing",
      detail:
        episodes.length === 0
          ? "No episodes uploaded"
          : `${withMaster}/${episodes.length} with masters`,
    });
  }

  rows.push({
    label: "Script PDF",
    status: payload.scriptUrl?.trim() ? "ok" : "na",
    detail: payload.scriptUrl?.trim() ? undefined : "Optional",
    url: payload.scriptUrl,
  });

  const playable = Boolean(
    payload.videoUrl?.trim() ||
      payload.trailerUrl?.trim() ||
      withMaster > 0,
  );

  return {
    rows,
    missing,
    requirements,
    playable,
    firstEpisodeId,
    episodeStats: { total: episodes.length, withMaster },
  };
}
