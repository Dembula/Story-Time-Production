import { prisma } from "@/lib/prisma";
import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";

type StreamAssetLink = {
  entityType: string | null;
  entityId: string | null;
  sourceUrl: string | null;
  hlsUrl: string | null;
  playbackUrl: string | null;
};

async function getStreamAssetLink(uid: string): Promise<StreamAssetLink | null> {
  const rows = (await prisma.$queryRaw`
    SELECT "entityType", "entityId", "sourceUrl", "hlsUrl", "playbackUrl"
    FROM "StreamAsset"
    WHERE "uid" = ${uid}
    LIMIT 1
  `) as StreamAssetLink[];
  return rows[0] ?? null;
}

/** When Cloudflare finishes processing, point linked catalogue rows at Stream playback URLs. */
export async function syncLinkedEntitiesAfterStreamReady(uid: string, state: string): Promise<void> {
  const normalized = state.toLowerCase();
  if (normalized !== "ready") return;

  const link = await getStreamAssetLink(uid);
  if (!link?.entityType || !link.entityId) return;

  const cfg = getCloudflareStreamConfig();
  const urls = cfg
    ? buildCloudflarePlaybackUrls(uid, cfg.customerSubdomain)
    : {
        hlsUrl: `https://videodelivery.net/${uid}/manifest/video.m3u8`,
        mp4Url: `https://videodelivery.net/${uid}/downloads/default.mp4`,
        thumbnailUrl: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`,
      };

  const playbackUrl = link.hlsUrl ?? urls.hlsUrl;
  const mp4Url = link.playbackUrl ?? urls.mp4Url;
  const thumbnailUrl = urls.thumbnailUrl;

  if (link.entityType === "Content" || link.entityType === "ContentTrailer") {
    const content = await prisma.content.findUnique({
      where: { id: link.entityId },
      select: { id: true, videoUrl: true, posterUrl: true, trailerUrl: true },
    });
    if (!content) return;

    const updates: { videoUrl?: string; posterUrl?: string; trailerUrl?: string } = {};
    const currentVideo = content.videoUrl?.trim() ?? "";
    const currentTrailer = content.trailerUrl?.trim() ?? "";
    const sourceUrl = link.sourceUrl?.trim() ?? "";
    const targetField =
      link.entityType === "ContentTrailer" ||
      (sourceUrl && currentTrailer === sourceUrl) ||
      extractCloudflareStreamUid(currentTrailer) === uid
        ? "trailerUrl"
        : "videoUrl";

    if (targetField === "trailerUrl") {
      const shouldSetTrailer =
        !currentTrailer ||
        !isCloudflareStreamUrl(currentTrailer) ||
        extractCloudflareStreamUid(currentTrailer) !== uid;

      if (shouldSetTrailer && playbackUrl) {
        updates.trailerUrl = playbackUrl;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.content.update({ where: { id: content.id }, data: updates });
      }
      return;
    }

    const shouldSetVideo =
      !currentVideo ||
      !isCloudflareStreamUrl(currentVideo) ||
      extractCloudflareStreamUid(currentVideo) !== uid;

    if (shouldSetVideo && playbackUrl) {
      updates.videoUrl = playbackUrl;
    }

    if (!content.posterUrl?.trim() && thumbnailUrl) {
      updates.posterUrl = thumbnailUrl;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.content.update({ where: { id: content.id }, data: updates });
    }
    return;
  }

  if (link.entityType === "BtsVideo") {
    const bts = await prisma.btsVideo.findUnique({
      where: { id: link.entityId },
      select: { id: true, videoUrl: true, thumbnail: true },
    });
    if (!bts) return;
    const updates: { videoUrl?: string; thumbnail?: string } = {};
    if (bts.videoUrl && !isCloudflareStreamUrl(bts.videoUrl)) {
      updates.videoUrl = mp4Url ?? playbackUrl;
    }
    if (!bts.thumbnail?.trim() && thumbnailUrl) {
      updates.thumbnail = thumbnailUrl;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.btsVideo.update({ where: { id: bts.id }, data: updates });
    }
    return;
  }

  if (link.entityType === "ContentEpisode") {
    const episode = await prisma.contentEpisode.findUnique({
      where: { id: link.entityId },
      select: { id: true, videoUrl: true, thumbnailUrl: true },
    });
    if (!episode) return;
    const updates: { videoUrl?: string; thumbnailUrl?: string } = {};
    const currentVideo = episode.videoUrl?.trim() ?? "";
    const shouldSetEpisodeVideo =
      !currentVideo ||
      !isCloudflareStreamUrl(currentVideo) ||
      extractCloudflareStreamUid(currentVideo) !== uid;

    if (shouldSetEpisodeVideo && playbackUrl) {
      updates.videoUrl = playbackUrl;
    }
    if (!episode.thumbnailUrl?.trim() && thumbnailUrl) {
      updates.thumbnailUrl = thumbnailUrl;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.contentEpisode.update({ where: { id: episode.id }, data: updates });
    }
  }
}
