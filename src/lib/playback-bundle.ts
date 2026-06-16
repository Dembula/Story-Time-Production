import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import { isLongFormType } from "@/lib/content-types";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";
import { getViewerPlaybackState } from "@/lib/viewer-access";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { type PlaybackSource } from "@/lib/playback-sources";
import { isCloudflareSignedPlaybackEnabled } from "@/lib/cloudflare-stream-signed-url";

export type PlaybackBundleSubtitle = {
  id: string;
  language: string;
  label: string;
  vttUrl: string;
  isDefault: boolean;
};

export type PlaybackBundleScene = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  summary: string | null;
  mood: string | null;
  actors: unknown;
};

export type PlaybackBundleData = {
  id: string;
  title: string;
  playback: PlaybackSource | null;
  playbackProtection: {
    signedUrl: boolean;
    expiresHintSeconds: number;
    authenticatedViewer: boolean;
  };
  posterUrl: string | null;
  duration: number | null;
  enrichment: {
    status: string;
    moodTags: string[];
    atmosphere: string | null;
    pacing: string | null;
    narrativeJson: unknown;
  } | null;
  scenes: PlaybackBundleScene[];
  subtitles: PlaybackBundleSubtitle[];
  captureProtection: {
    enabled: boolean;
    mode: "standard" | "drm";
    watermarkEnabled: boolean;
    drmConfigured: boolean;
    drmLicensePath: string | null;
  };
};

type PlaybackBundleAuth = {
  userId: string | null | undefined;
  role?: string | null;
  profileId?: string | null;
};

export type PlaybackBundleOptions = {
  contentId: string;
  episodeId?: string | null;
  isTrailer?: boolean;
  auth?: PlaybackBundleAuth | null;
};

export class PlaybackBundleError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PlaybackBundleError";
    this.status = status;
  }
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

export async function getPlaybackBundleData({
  contentId,
  episodeId = null,
  isTrailer = false,
  auth = null,
}: PlaybackBundleOptions): Promise<PlaybackBundleData> {
  const content = await prisma.content.findFirst({
    where: { id: contentId, published: true },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      trailerUrl: true,
      posterUrl: true,
      backdropUrl: true,
      duration: true,
      type: true,
      minAge: true,
      seasons: {
        where: { published: true },
        orderBy: { seasonNumber: "asc" },
        select: {
          episodes: {
            orderBy: { episodeNumber: "asc" },
            select: { id: true, videoUrl: true, duration: true },
          },
        },
      },
      enrichment: {
        select: {
          status: true,
          moodTags: true,
          atmosphere: true,
          pacing: true,
          narrativeJson: true,
        },
      },
      scenes: {
        orderBy: { startSeconds: "asc" },
        take: 24,
        select: {
          id: true,
          startSeconds: true,
          endSeconds: true,
          summary: true,
          mood: true,
          actors: true,
        },
      },
      subtitles: {
        select: { id: true, language: true, label: true, vttUrl: true, isDefault: true },
      },
    },
  });

  if (!content) {
    throw new PlaybackBundleError(404, "Not found");
  }

  if (auth) {
    await assertViewerPlaybackAccess({
      contentId: content.id,
      minAge: content.minAge ?? 0,
      auth,
    });
  }

  let videoUrl = isTrailer ? content.trailerUrl : content.videoUrl;
  let duration = isTrailer ? null : content.duration;

  if (!isTrailer && episodeId) {
    const episode = content.seasons
      .flatMap((season) => season.episodes)
      .find((candidate) => candidate.id === episodeId);

    if (!episode?.videoUrl) {
      throw new PlaybackBundleError(404, "Episode not found");
    }

    videoUrl = episode.videoUrl;
    duration = episode.duration ?? duration;
  } else if (!isTrailer && !videoUrl && isLongFormType(content.type)) {
    const firstEpisode = content.seasons
      .flatMap((season) => season.episodes)
      .find((candidate) => candidate.videoUrl);

    if (firstEpisode?.videoUrl) {
      videoUrl = firstEpisode.videoUrl;
      duration = firstEpisode.duration ?? duration;
    }
  }

  const playback = await resolveServerPlaybackSource(videoUrl);
  const posterUrl = getDisplayPosterUrl(content);
  const captureProtection = getServerCaptureProtectionConfig();
  const signedPlaybackEnabled = isCloudflareSignedPlaybackEnabled();

  return {
    id: content.id,
    title: content.title,
    playback,
    playbackProtection: {
      signedUrl:
        signedPlaybackEnabled &&
        Boolean(playback?.src.includes("/manifest/video.m3u8")),
      expiresHintSeconds: 4 * 60 * 60,
      authenticatedViewer: Boolean(auth?.userId),
    },
    posterUrl,
    duration,
    enrichment:
      isTrailer || !content.enrichment
        ? null
        : {
            ...content.enrichment,
            moodTags: normalizeStringArray(content.enrichment.moodTags),
          },
    scenes: isTrailer ? [] : content.scenes,
    subtitles: isTrailer ? [] : content.subtitles,
    captureProtection: {
      enabled: captureProtection.enabled,
      mode: captureProtection.mode,
      watermarkEnabled: captureProtection.watermarkEnabled,
      drmConfigured: Boolean(captureProtection.drmLicenseUrl),
      drmLicensePath: captureProtection.drmLicenseUrl ? "/api/content/drm-license" : null,
    },
  };
}

async function assertViewerPlaybackAccess({
  contentId,
  minAge,
  auth,
}: {
  contentId: string;
  minAge: number;
  auth: PlaybackBundleAuth;
}) {
  if (!auth.userId || auth.role !== "SUBSCRIBER") {
    throw new PlaybackBundleError(401, "Unauthorized");
  }

  if (!auth.profileId) {
    throw new PlaybackBundleError(403, "Viewer profile required");
  }

  const [profile, playback] = await Promise.all([
    prisma.viewerProfile.findFirst({
      where: { id: auth.profileId, userId: auth.userId },
      select: { age: true, dateOfBirth: true },
    }),
    getViewerPlaybackState(auth.userId, contentId),
  ]);

  if (!profile) {
    throw new PlaybackBundleError(403, "Viewer profile required");
  }

  if (!playback.subscription || !playback.canPlayContent) {
    throw new PlaybackBundleError(403, "Playback is not allowed for this viewer");
  }

  const profileAge = getViewerProfileAge(profile);
  if (profileAge != null && minAge > profileAge) {
    throw new PlaybackBundleError(403, "Viewer profile is age restricted");
  }
}
